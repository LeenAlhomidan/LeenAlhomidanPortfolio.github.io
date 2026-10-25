(function () {
	'use strict';

	var root = document.querySelector('[data-sales-dashboard]');
	var data = window.SalesDashboardData;

	if (!root || !data) {
		return;
	}

	var state = {
		year: data.defaults.year.slice(),
		month: data.defaults.month.slice(),
		saleType: data.defaults.saleType.slice(),
		paymentMode: data.defaults.paymentMode.slice()
	};
	var productOffset = null;
	var productRange = document.getElementById('sales-product-range');
	var svgNamespace = 'http://www.w3.org/2000/svg';
	var moneyFormatter = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
	var integerFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 0
	});

	function rounded(value) {
		return Math.round((value + Number.EPSILON) * 100) / 100;
	}

	function money(value) {
		return 'SAR ' + moneyFormatter.format(rounded(value));
	}

	function compactAmount(value) {
		if (value >= 1000) {
			return (Math.round(value / 100) / 10) + 'k';
		}
		return integerFormatter.format(value);
	}

	function selected(filter, value) {
		return state[filter].indexOf(value) !== -1;
	}

	function matches(cell, ignoredFilter) {
		return (ignoredFilter === 'year' || selected('year', cell.year))
			&& (ignoredFilter === 'month' || selected('month', cell.month))
			&& (ignoredFilter === 'saleType' || selected('saleType', cell.saleType))
			&& (ignoredFilter === 'paymentMode' || selected('paymentMode', cell.paymentMode));
	}

	function createAggregate() {
		return {
			sales: 0,
			cost: 0,
			products: new Map(),
			categories: new Map(),
			months: new Map(),
			days: new Map()
		};
	}

	function aggregate(ignoredFilter) {
		var result = createAggregate();

		data.cells.forEach(function (cell) {
			if (!matches(cell, ignoredFilter)) {
				return;
			}

			result.sales += cell.sales;
			result.cost += cell.cost;

			var month = result.months.get(cell.month) || { sales: 0, cost: 0 };
			month.sales += cell.sales;
			month.cost += cell.cost;
			result.months.set(cell.month, month);

			cell.products.forEach(function (product) {
				var current = result.products.get(product.name) || {
					name: product.name,
					unit: product.unit,
					sales: 0,
					quantity: 0
				};
				current.sales += product.sales;
				current.quantity += product.quantity;
				result.products.set(product.name, current);
			});

			cell.categories.forEach(function (category) {
				result.categories.set(
					category.name,
					(result.categories.get(category.name) || 0) + category.sales
				);
			});

			cell.days.forEach(function (day) {
				result.days.set(
					day.day,
					(result.days.get(day.day) || 0) + day.sales
				);
			});
		});

		return result;
	}

	function sumByDimension(dimension, ignoredFilter) {
		var totals = new Map();

		data.cells.forEach(function (cell) {
			if (!matches(cell, ignoredFilter)) {
				return;
			}
			totals.set(dimension === 'saleType' ? cell.saleType : cell.paymentMode,
				(totals.get(dimension === 'saleType' ? cell.saleType : cell.paymentMode) || 0) + cell.sales);
		});

		return Array.from(totals, function (entry) {
			return { name: entry[0], sales: entry[1] };
		});
	}

	function createSvg(container, width, height, title) {
		container.textContent = '';
		var svg = document.createElementNS(svgNamespace, 'svg');
		svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
		svg.setAttribute('role', 'presentation');
		svg.setAttribute('aria-hidden', 'true');

		var titleNode = document.createElementNS(svgNamespace, 'title');
		titleNode.textContent = title;
		svg.appendChild(titleNode);
		container.appendChild(svg);
		return svg;
	}

	function svgElement(parent, name, attributes, text) {
		var element = document.createElementNS(svgNamespace, name);
		Object.keys(attributes || {}).forEach(function (key) {
			element.setAttribute(key, attributes[key]);
		});
		if (text !== undefined) {
			element.textContent = text;
		}
		parent.appendChild(element);
		return element;
	}

	function showEmpty(container) {
		container.textContent = '';
		var message = document.createElement('div');
		message.className = 'chart-empty';
		message.textContent = 'No matching data';
		container.appendChild(message);
	}

	function renderFilters() {
		var groups = [
			{ key: 'year', values: data.years.map(String) },
			{ key: 'month', values: data.months },
			{ key: 'saleType', values: data.saleTypes },
			{ key: 'paymentMode', values: data.paymentModes }
		];

		groups.forEach(function (group) {
			var container = document.getElementById('sales-filter-' + group.key);
			container.textContent = '';

			var allButton = makeFilterButton(group.key, '__all', 'All',
				state[group.key].length === group.values.length);
			container.appendChild(allButton);

			group.values.forEach(function (value, index) {
				var actualValue = group.key === 'year' ? Number(value)
					: group.key === 'month' ? index + 1 : value;
				container.appendChild(makeFilterButton(
					group.key,
					String(actualValue),
					value,
					selected(group.key, actualValue)
				));
			});
		});
	}

	function makeFilterButton(filter, value, label, isSelected) {
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'sales-filter-button';
		button.dataset.filter = filter;
		button.dataset.value = value;
		button.setAttribute('aria-pressed', String(isSelected));
		button.textContent = label;
		return button;
	}

	function updateMetric(id, value, detail) {
		var element = document.getElementById(id);
		element.textContent = value;
		if (detail) {
			var note = document.createElement('span');
			note.className = 'sales-metric-detail';
			note.textContent = detail;
			element.appendChild(note);
		}
	}

	function renderMetrics(result, matchedCount) {
		var profit = rounded(result.sales - result.cost);
		var margin = result.cost ? Math.round(profit / result.cost * 100) + '%' : '—';

		if (!matchedCount) {
			updateMetric('sales-total', '—');
			updateMetric('sales-profit', '—');
			updateMetric('sales-margin', '—');
			updateMetric('sales-top-product', '—');
			updateMetric('sales-top-category', '—');
			return;
		}

		updateMetric('sales-total', money(result.sales));
		updateMetric('sales-profit', money(profit));
		updateMetric('sales-margin', margin);

		var bestProduct = Array.from(result.products.values()).sort(function (a, b) {
			return b.sales - a.sales || a.name.localeCompare(b.name, 'en');
		})[0];
		var bestCategory = Array.from(result.categories.entries()).sort(function (a, b) {
			return b[1] - a[1] || a[0].localeCompare(b[0], 'en');
		})[0];

		if (bestProduct) {
			updateMetric('sales-top-product', bestProduct.name,
				bestProduct.unit + ' · ' + integerFormatter.format(bestProduct.quantity) + ' · ' + money(bestProduct.sales));
		} else {
			updateMetric('sales-top-product', '—');
		}

		if (bestCategory) {
			updateMetric('sales-top-category', bestCategory[0],
				money(bestCategory[1]));
		} else {
			updateMetric('sales-top-category', '—');
		}
	}

	function renderMonthlyChart(result) {
		var container = document.getElementById('sales-monthly-chart');
		if (!result.sales) {
			showEmpty(container);
			return;
		}

		var width = 640;
		var height = 250;
		var margin = { top: 20, right: 12, bottom: 40, left: 46 };
		var plotWidth = width - margin.left - margin.right;
		var plotHeight = height - margin.top - margin.bottom;
		var monthlyValues = data.months.map(function (name, index) {
			var values = result.months.get(index + 1) || { sales: 0, cost: 0 };
			return { name: name, sales: values.sales, profit: values.sales - values.cost };
		});
		var maximum = Math.max.apply(null, monthlyValues.map(function (item) {
			return item.sales;
		}));
		var scaleMaximum = Math.max(1, Math.ceil(maximum / 5000) * 5000);
		var svg = createSvg(container, width, height, 'Monthly sales and profit');
		var tickCount = 4;

		for (var tick = 0; tick <= tickCount; tick += 1) {
			var amount = scaleMaximum * tick / tickCount;
			var y = margin.top + plotHeight - plotHeight * tick / tickCount;
			svgElement(svg, 'line', {
				x1: margin.left,
				y1: y,
				x2: width - margin.right,
				y2: y,
				class: tick === 0 ? 'chart-axis' : 'chart-gridline'
			});
			svgElement(svg, 'text', {
				x: margin.left - 7,
				y: y + 4,
				'text-anchor': 'end'
			}, compactAmount(amount));
		}

		var band = plotWidth / monthlyValues.length;
		var barWidth = Math.min(13, band * 0.28);
		monthlyValues.forEach(function (item, index) {
			var center = margin.left + band * (index + 0.5);
			var salesHeight = item.sales / scaleMaximum * plotHeight;
			var profitHeight = Math.max(0, item.profit) / scaleMaximum * plotHeight;
			var salesBar = svgElement(svg, 'rect', {
				x: center - barWidth - 1,
				y: margin.top + plotHeight - salesHeight,
				width: barWidth,
				height: salesHeight,
				rx: 2,
				fill: '#c52d32'
			});
			var salesTitle = document.createElementNS(svgNamespace, 'title');
			salesTitle.textContent = item.name + ' sales: ' + money(item.sales);
			salesBar.appendChild(salesTitle);

			var profitBar = svgElement(svg, 'rect', {
				x: center + 1,
				y: margin.top + plotHeight - profitHeight,
				width: barWidth,
				height: profitHeight,
				rx: 2,
				fill: '#d1a63b'
			});
			var profitTitle = document.createElementNS(svgNamespace, 'title');
			profitTitle.textContent = item.name + ' profit: ' + money(item.profit);
			profitBar.appendChild(profitTitle);

			svgElement(svg, 'text', {
				x: center,
				y: height - 18,
				'text-anchor': 'middle'
			}, item.name);
		});

		svgElement(svg, 'rect', { x: 234, y: 3, width: 10, height: 10, rx: 2, fill: '#c52d32' });
		svgElement(svg, 'text', { x: 249, y: 12 }, 'Sales');
		svgElement(svg, 'rect', { x: 302, y: 3, width: 10, height: 10, rx: 2, fill: '#d1a63b' });
		svgElement(svg, 'text', { x: 317, y: 12 }, 'Profit');
	}

	function renderDailyChart(result) {
		var container = document.getElementById('sales-daily-chart');
		if (!result.sales) {
			showEmpty(container);
			return;
		}

		var width = 640;
		var height = 250;
		var margin = { top: 14, right: 12, bottom: 34, left: 44 };
		var plotWidth = width - margin.left - margin.right;
		var plotHeight = height - margin.top - margin.bottom;
		var values = [];
		for (var day = 1; day <= 31; day += 1) {
			values.push({ day: day, sales: result.days.get(day) || 0 });
		}
		var maximum = Math.max.apply(null, values.map(function (item) {
			return item.sales;
		}));
		var scaleMaximum = Math.max(1, Math.ceil(maximum / 2000) * 2000);
		var svg = createSvg(container, width, height, 'Daily sales');

		for (var tick = 0; tick <= 4; tick += 1) {
			var amount = scaleMaximum * tick / 4;
			var y = margin.top + plotHeight - plotHeight * tick / 4;
			svgElement(svg, 'line', {
				x1: margin.left,
				y1: y,
				x2: width - margin.right,
				y2: y,
				class: tick === 0 ? 'chart-axis' : 'chart-gridline'
			});
			svgElement(svg, 'text', {
				x: margin.left - 7,
				y: y + 4,
				'text-anchor': 'end'
			}, compactAmount(amount));
		}

		var points = values.map(function (item, index) {
			var x = margin.left + plotWidth * index / (values.length - 1);
			var y = margin.top + plotHeight - item.sales / scaleMaximum * plotHeight;
			return { x: x, y: y, item: item };
		});
		var areaPath = 'M ' + points[0].x + ' ' + (margin.top + plotHeight)
			+ ' L ' + points.map(function (point) {
				return point.x + ' ' + point.y;
			}).join(' L ')
			+ ' L ' + points[points.length - 1].x + ' ' + (margin.top + plotHeight) + ' Z';
		svgElement(svg, 'path', {
			d: areaPath,
			fill: '#c52d32',
			'fill-opacity': '0.72'
		});
		svgElement(svg, 'path', {
			d: 'M ' + points.map(function (point) {
				return point.x + ' ' + point.y;
			}).join(' L '),
			fill: 'none',
			stroke: '#f05a5e',
			'stroke-width': '2'
		});

		points.forEach(function (point) {
			if (point.item.sales > 0) {
				var marker = svgElement(svg, 'circle', {
					cx: point.x,
					cy: point.y,
					r: 2.5,
					fill: '#f4d3d0'
				});
				var title = document.createElementNS(svgNamespace, 'title');
				title.textContent = 'Day ' + point.item.day + ': ' + money(point.item.sales);
				marker.appendChild(title);
			}
		});

		for (var labelDay = 1; labelDay <= 31; labelDay += 5) {
			var labelX = margin.left + plotWidth * (labelDay - 1) / (values.length - 1);
			svgElement(svg, 'text', {
				x: labelX,
				y: height - 12,
				'text-anchor': 'middle'
			}, String(labelDay));
		}
	}

	function renderProductChart(result) {
		var container = document.getElementById('sales-product-chart');
		var products = Array.from(result.products.values()).filter(function (product) {
			return product.sales > 0;
		}).sort(function (a, b) {
			return a.name.localeCompare(b.name, 'en', { numeric: true });
		});

		if (!products.length) {
			productRange.max = '0';
			productRange.value = '0';
			document.getElementById('sales-product-range-label').textContent = '—';
			showEmpty(container);
			return;
		}

		var maximumOffset = Math.max(0, products.length - 10);
		if (productOffset === null) {
			var startingIndex = products.findIndex(function (product) {
				return product.name === 'Product35';
			});
			productOffset = Math.max(0, startingIndex);
		}
		productOffset = Math.min(productOffset, maximumOffset);
		productRange.max = String(maximumOffset);
		productRange.value = String(productOffset);

		var visible = products.slice(productOffset, productOffset + 10);
		var lastVisible = visible[visible.length - 1];
		document.getElementById('sales-product-range-label').textContent =
			visible[0].name + '–' + lastVisible.name;

		var width = 400;
		var rowHeight = 23;
		var height = Math.max(120, visible.length * rowHeight + 12);
		var marginLeft = 87;
		var plotWidth = width - marginLeft - 10;
		var maximum = Math.max.apply(null, visible.map(function (product) {
			return product.sales;
		}));
		var svg = createSvg(container, width, height, 'Product sales');

		visible.forEach(function (product, index) {
			var y = 8 + index * rowHeight;
			var barWidth = maximum ? product.sales / maximum * plotWidth : 0;
			svgElement(svg, 'text', {
				x: marginLeft - 7,
				y: y + 13,
				'text-anchor': 'end'
			}, product.name);
			var bar = svgElement(svg, 'rect', {
				x: marginLeft,
				y: y + 2,
				width: Math.max(1, barWidth),
				height: 15,
				rx: 2,
				fill: '#c52d32'
			});
			var title = document.createElementNS(svgNamespace, 'title');
			title.textContent = product.name + ': ' + money(product.sales)
				+ ' · ' + integerFormatter.format(product.quantity) + ' ' + product.unit;
			bar.appendChild(title);
			svgElement(svg, 'text', {
				x: Math.min(width - 7, marginLeft + barWidth + 5),
				y: y + 13,
				'text-anchor': barWidth > plotWidth * 0.72 ? 'end' : 'start'
			}, compactAmount(product.sales));
		});
	}

	function renderPieChart(container, items, colors, title) {
		items = items.filter(function (item) {
			return item.sales > 0;
		});
		var total = items.reduce(function (sum, item) {
			return sum + item.sales;
		}, 0);

		if (!total) {
			showEmpty(container);
			return;
		}

		var width = 320;
		var height = 190;
		var centerX = 84;
		var centerY = 94;
		var radius = 69;
		var svg = createSvg(container, width, height, title);
		var angle = -Math.PI / 2;

		items.forEach(function (item, index) {
			var sweep = item.sales / total * Math.PI * 2;
			var color = colors[index % colors.length];
			var slice;

			if (items.length === 1) {
				slice = svgElement(svg, 'circle', {
					cx: centerX,
					cy: centerY,
					r: radius,
					fill: color
				});
			} else {
				var endAngle = angle + sweep;
				var x1 = centerX + radius * Math.cos(angle);
				var y1 = centerY + radius * Math.sin(angle);
				var x2 = centerX + radius * Math.cos(endAngle);
				var y2 = centerY + radius * Math.sin(endAngle);
				var largeArc = sweep > Math.PI ? 1 : 0;
				slice = svgElement(svg, 'path', {
					d: 'M ' + centerX + ' ' + centerY + ' L ' + x1 + ' ' + y1
						+ ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 '
						+ x2 + ' ' + y2 + ' Z',
					fill: color,
					stroke: '#48464a',
					'stroke-width': '1'
				});
				angle = endAngle;
			}

			var sliceTitle = document.createElementNS(svgNamespace, 'title');
			sliceTitle.textContent = item.name + ': ' + money(item.sales)
				+ ' (' + Math.round(item.sales / total * 100) + '%)';
			slice.appendChild(sliceTitle);

			var legendY = 43 + index * 38;
			svgElement(svg, 'rect', {
				x: 171,
				y: legendY - 9,
				width: 10,
				height: 10,
				rx: 2,
				fill: color
			});
			svgElement(svg, 'text', { x: 188, y: legendY }, item.name);
			svgElement(svg, 'text', {
				x: 188,
				y: legendY + 15,
				fill: '#c8c2b7'
			}, money(item.sales));
		});
	}

	function drawTreemapItems(svg, items, x, y, width, height) {
		if (items.length === 1) {
			var item = items[0];
			var color = ['#168545', '#087bb1', '#d1a63b', '#c52d32', '#8253ad'][item.index % 5];
			svgElement(svg, 'rect', {
				x: x,
				y: y,
				width: Math.max(0, width - 2),
				height: Math.max(0, height - 2),
				rx: 2,
				fill: color
			});

			if (width > 65 && height > 34) {
				svgElement(svg, 'text', {
					x: x + width / 2,
					y: y + height / 2 - 3,
					'text-anchor': 'middle',
					'font-size': '11',
					'font-weight': '700'
				}, item.name);
				if (height > 52 && width > 85) {
					svgElement(svg, 'text', {
						x: x + width / 2,
						y: y + height / 2 + 14,
						'text-anchor': 'middle',
						'font-size': '9'
					}, compactAmount(item.sales));
				}
			}
			return;
		}

		var total = items.reduce(function (sum, item) {
			return sum + item.sales;
		}, 0);
		var leftTotal = 0;
		var splitIndex = 0;
		while (splitIndex < items.length - 1 && leftTotal < total / 2) {
			leftTotal += items[splitIndex].sales;
			splitIndex += 1;
		}
		var leftItems = items.slice(0, splitIndex);
		var rightItems = items.slice(splitIndex);
		var ratio = leftTotal / total;

		if (width >= height) {
			var leftWidth = width * ratio;
			drawTreemapItems(svg, leftItems, x, y, leftWidth, height);
			drawTreemapItems(svg, rightItems, x + leftWidth, y, width - leftWidth, height);
		} else {
			var topHeight = height * ratio;
			drawTreemapItems(svg, leftItems, x, y, width, topHeight);
			drawTreemapItems(svg, rightItems, x, y + topHeight, width, height - topHeight);
		}
	}

	function renderCategoryChart(result) {
		var container = document.getElementById('sales-category-chart');
		var items = Array.from(result.categories, function (entry, index) {
			return { name: entry[0], sales: entry[1], index: index };
		}).filter(function (item) {
			return item.sales > 0;
		}).sort(function (a, b) {
			return b.sales - a.sales;
		});

		if (!items.length) {
			showEmpty(container);
			return;
		}

		var svg = createSvg(container, 400, 250, 'Sales by category treemap');
		drawTreemapItems(svg, items, 0, 0, 400, 250);
	}

	function renderDashboard() {
		var result = aggregate();
		var matchedCount = data.cells.filter(function (cell) {
			return matches(cell);
		}).length;
		var saleTypeValues = sumByDimension('saleType', 'saleType');
		var paymentValues = sumByDimension('paymentMode', 'paymentMode');

		renderFilters();
		renderMetrics(result, matchedCount);
		renderMonthlyChart(result);
		renderDailyChart(result);
		renderProductChart(result);
		renderPieChart(
			document.getElementById('sales-type-chart'),
			saleTypeValues,
			['#c52d32', '#168545', '#d1a63b'],
			'Sales by type'
		);
		renderPieChart(
			document.getElementById('sales-payment-chart'),
			paymentValues,
			['#168545', '#087bb1'],
			'Sales by payment mode'
		);
		renderCategoryChart(result);

	}

	root.addEventListener('click', function (event) {
		var button = event.target.closest('[data-filter]');
		if (!button) {
			return;
		}

		var filter = button.dataset.filter;
		var value = button.dataset.value;
		var values = filter === 'year' ? data.years
			: filter === 'month' ? data.months.map(function (_, index) { return index + 1; })
				: filter === 'saleType' ? data.saleTypes : data.paymentModes;

		if (value === '__all') {
			state[filter] = state[filter].length === values.length ? [] : values.slice();
		} else {
			var parsedValue = filter === 'year' || filter === 'month' ? Number(value) : value;
			if (state[filter].length === values.length) {
				state[filter] = [parsedValue];
			} else if (selected(filter, parsedValue)) {
				state[filter] = state[filter].filter(function (item) {
					return item !== parsedValue;
				});
			} else {
				state[filter].push(parsedValue);
			}
		}

		renderDashboard();
	});

	productRange.addEventListener('input', function () {
		productOffset = Number(productRange.value);
		renderProductChart(aggregate());
	});

	renderDashboard();
}());
