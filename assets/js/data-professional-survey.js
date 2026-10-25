(function () {
	'use strict';

	var root = document.querySelector('[data-survey-dashboard]');
	var data = window.DataProfessionalSurveyData;

	if (!root || !data) {
		return;
	}

	var colors = ['#59A33A', '#2D386D', '#AD8F21', '#7B1C25', '#5C97D2', '#661F89'];
	var genderColors = ['#59A33A', '#7B1C25'];
	var svgNamespace = 'http://www.w3.org/2000/svg';
	var selectedRoles = data.roles.map(function (role) {
		return role.name;
	});
	var numberFormat = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 0
	});
	var decimalFormat = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

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

	function showEmpty(container, message) {
		container.textContent = '';
		var empty = document.createElement('div');
		empty.className = 'chart-empty';
		empty.textContent = message || 'No matching survey data';
		container.appendChild(empty);
	}

	function getSelectedRoleRows() {
		return data.roles.filter(function (role) {
			return selectedRoles.indexOf(role.name) !== -1;
		});
	}

	function isAllRolesSelected() {
		return selectedRoles.length === data.roles.length;
	}

	function weightedAverage(rows, valueKey, weightKey) {
		var total = 0;
		var weight = 0;
		rows.forEach(function (row) {
			if (row[valueKey] !== null && row[weightKey] > 0) {
				total += row[valueKey] * row[weightKey];
				weight += row[weightKey];
			}
		});
		return weight ? total / weight : null;
	}

	function getSummary(rows) {
		if (isAllRolesSelected()) {
			return data.overall;
		}
		if (!rows.length) {
			return null;
		}

		return {
			respondents: rows.reduce(function (sum, row) {
				return sum + row.respondents;
			}, 0),
			averageAge: weightedAverage(rows, 'averageAge', 'ageN'),
			averageSalary: weightedAverage(rows, 'averageSalary', 'salaryN'),
			salarySatisfaction: weightedAverage(rows, 'salarySatisfaction', 'salaryScoreN'),
			workLifeSatisfaction: weightedAverage(rows, 'workLifeSatisfaction', 'workLifeScoreN')
		};
	}

	function updateMetric(id, value) {
		document.getElementById(id).textContent = value;
	}

	function renderRoleFilters() {
		var container = document.getElementById('survey-role-filter');
		container.textContent = '';

		data.roles.forEach(function (role) {
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'survey-role-button';
			button.dataset.role = role.name;
			button.setAttribute('aria-pressed', String(selectedRoles.indexOf(role.name) !== -1));
			button.textContent = role.name;
			container.appendChild(button);
		});

		var reset = root.querySelector('[data-survey-role-reset]');
		reset.setAttribute('aria-pressed', String(isAllRolesSelected()));
	}

	function renderMetrics(summary) {
		if (!summary || !summary.respondents) {
			updateMetric('survey-respondents', '—');
			updateMetric('survey-average-age', '—');
			updateMetric('survey-average-salary', '—');
			return;
		}

		updateMetric('survey-respondents', numberFormat.format(summary.respondents));
		updateMetric('survey-average-age',
			summary.averageAge === null ? '—' : decimalFormat.format(summary.averageAge));
		updateMetric('survey-average-salary',
			summary.averageSalary === null ? '—' : '$' + decimalFormat.format(summary.averageSalary) + 'k');
	}

	function arcPath(centerX, centerY, radius, startAngle, endAngle) {
		var startX = centerX + radius * Math.cos(startAngle);
		var startY = centerY + radius * Math.sin(startAngle);
		var endX = centerX + radius * Math.cos(endAngle);
		var endY = centerY + radius * Math.sin(endAngle);
		var largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
		return 'M ' + startX + ' ' + startY + ' A ' + radius + ' ' + radius
			+ ' 0 ' + largeArc + ' 1 ' + endX + ' ' + endY;
	}

	function renderGauge(containerId, score, title, color) {
		var container = document.getElementById(containerId);
		if (score === null || !Number.isFinite(score)) {
			showEmpty(container);
			return;
		}

		var clampedScore = Math.max(0, Math.min(10, score));
		var scoreClass = clampedScore >= 5 ? ' gauge-positive' : '';
		var svg = createSvg(container, 240, 146, title);
		var startAngle = Math.PI;
		var endAngle = startAngle + Math.PI * clampedScore / 10;
		var track = svgElement(svg, 'path', {
			d: arcPath(120, 117, 76, startAngle, Math.PI * 2),
			class: 'gauge-track'
		});
		var trackTitle = document.createElementNS(svgNamespace, 'title');
		trackTitle.textContent = 'Scale from 0 to 10';
		track.appendChild(trackTitle);
		var gaugeValue = svgElement(svg, 'path', {
			d: arcPath(120, 117, 76, startAngle, endAngle),
			class: 'gauge-value' + scoreClass,
			stroke: color
		});
		var gaugeTitle = document.createElementNS(svgNamespace, 'title');
		gaugeTitle.textContent = decimalFormat.format(clampedScore) + ' out of 10';
		gaugeValue.appendChild(gaugeTitle);
		svgElement(svg, 'text', {
			x: 120,
			y: 97,
			'text-anchor': 'middle',
			class: 'gauge-score' + scoreClass,
			fill: color
		}, decimalFormat.format(clampedScore));
		svgElement(svg, 'text', {
			x: 120,
			y: 117,
			'text-anchor': 'middle',
			class: 'gauge-scale'
		}, 'OUT OF 10');
		svgElement(svg, 'text', {
			x: 35,
			y: 138,
			'text-anchor': 'middle',
			class: 'gauge-scale'
		}, '0');
		svgElement(svg, 'text', {
			x: 205,
			y: 138,
			'text-anchor': 'middle',
			class: 'gauge-scale'
		}, '10');
		container.setAttribute('aria-label', title + ': ' + decimalFormat.format(clampedScore) + ' out of 10');
	}

	function renderGauges(summary) {
		var thresholdColor = function (score) {
			return score !== null && score >= 5 ? '#14482C' : '#7B1C25';
		};
		renderGauge(
			'survey-salary-gauge',
			summary ? summary.salarySatisfaction : null,
			'Average salary satisfaction',
			thresholdColor(summary ? summary.salarySatisfaction : null)
		);
		renderGauge(
			'survey-worklife-gauge',
			summary ? summary.workLifeSatisfaction : null,
			'Average work-life balance satisfaction',
			thresholdColor(summary ? summary.workLifeSatisfaction : null)
		);
	}

	function renderLanguageLegend(roles) {
		var container = document.getElementById('survey-language-legend');
		container.textContent = '';
		roles.forEach(function (role, index) {
			var item = document.createElement('span');
			item.className = 'survey-legend-item';
			var swatch = document.createElement('span');
			swatch.className = 'survey-legend-swatch';
			swatch.style.backgroundColor = colors[index % colors.length];
			var label = document.createElement('span');
			label.textContent = role.name;
			item.appendChild(swatch);
			item.appendChild(label);
			container.appendChild(item);
		});
	}

	function renderLanguageChart(roles) {
		var container = document.getElementById('survey-language-chart');
		var roleNames = roles.map(function (role) {
			return role.name;
		});
		var rows = data.favoriteLanguageByRole.filter(function (item) {
			return roleNames.indexOf(item.role) !== -1;
		});

		if (!rows.length) {
			showEmpty(container);
			document.getElementById('survey-language-legend').textContent = '';
			return;
		}

		var grouped = new Map();
		rows.forEach(function (item) {
			if (!grouped.has(item.language)) {
				grouped.set(item.language, new Map());
			}
			grouped.get(item.language).set(item.role, item.respondents);
		});
		var languages = Array.from(grouped.keys()).sort(function (a, b) {
			var aTotal = Array.from(grouped.get(a).values()).reduce(function (sum, count) { return sum + count; }, 0);
			var bTotal = Array.from(grouped.get(b).values()).reduce(function (sum, count) { return sum + count; }, 0);
			return bTotal - aTotal || a.localeCompare(b);
		});
		var maximum = Math.max.apply(null, languages.map(function (language) {
			return Array.from(grouped.get(language).values()).reduce(function (sum, count) {
				return sum + count;
			}, 0);
		}));
		var scaleMaximum = Math.max(10, Math.ceil(maximum / 50) * 50);
		var width = 650;
		var height = 310;
		var margin = { top: 14, right: 14, bottom: 52, left: 45 };
		var plotWidth = width - margin.left - margin.right;
		var plotHeight = height - margin.top - margin.bottom;
		var svg = createSvg(container, width, height, 'Favorite programming language by role');

		for (var tick = 0; tick <= 4; tick += 1) {
			var value = scaleMaximum * tick / 4;
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
			}, numberFormat.format(value));
		}

		var band = plotWidth / languages.length;
		var barWidth = Math.min(47, band * 0.58);
		languages.forEach(function (language, languageIndex) {
			var x = margin.left + band * (languageIndex + 0.5) - barWidth / 2;
			var yBottom = margin.top + plotHeight;
			var total = 0;

			roles.forEach(function (role, roleIndex) {
				var count = grouped.get(language).get(role.name) || 0;
				if (!count) {
					return;
				}
				total += count;
				var barHeight = count / scaleMaximum * plotHeight;
				yBottom -= barHeight;
				var segment = svgElement(svg, 'rect', {
					x: x,
					y: yBottom,
					width: barWidth,
					height: Math.max(1, barHeight),
					fill: colors[roleIndex % colors.length],
					rx: 1
				});
				var segmentTitle = document.createElementNS(svgNamespace, 'title');
				segmentTitle.textContent = language + ' · ' + role.name + ': ' + numberFormat.format(count);
				segment.appendChild(segmentTitle);
			});

			svgElement(svg, 'text', {
				x: x + barWidth / 2,
				y: height - 22,
				'text-anchor': 'middle'
			}, language);
			var totalLabelY = Math.max(margin.top + 10, yBottom - 5);
			svgElement(svg, 'text', {
				x: x + barWidth / 2,
				y: totalLabelY,
				'text-anchor': 'middle',
				'font-weight': '700'
			}, numberFormat.format(total));
		});

		renderLanguageLegend(roles);
	}

	function roleSalaryRows(roles) {
		return roles.map(function (role) {
			return {
				name: role.name,
				respondents: role.respondents,
				value: role.averageSalary
			};
		}).filter(function (item) {
			return item.value !== null && item.respondents >= data.privacyThreshold;
		});
	}

	function genderSalaryRows(roles) {
		if (isAllRolesSelected()) {
			return data.salaryByGender.map(function (item) {
				return {
					name: item.name,
					respondents: item.respondents,
					value: item.averageSalary,
					weight: item.salaryN
				};
			});
		}

		var selectedNames = roles.map(function (role) {
			return role.name;
		});
		var grouped = new Map();
		data.salaryByRoleGender.forEach(function (item) {
			if (selectedNames.indexOf(item.role) === -1) {
				return;
			}
			var current = grouped.get(item.gender) || { total: 0, weight: 0 };
			current.total += item.averageSalary * item.salaryN;
			current.weight += item.salaryN;
			grouped.set(item.gender, current);
		});
		return Array.from(grouped, function (entry) {
			return {
				name: entry[0],
				value: entry[1].weight ? entry[1].total / entry[1].weight : null,
				weight: entry[1].weight
			};
		}).filter(function (item) {
			return item.value !== null;
		});
	}

	function renderDonutChart(containerId, rows, title, centerLabel, palette) {
		var container = document.getElementById(containerId);
		rows = rows.filter(function (item) {
			return item.value !== null && item.value > 0;
		});
		if (!rows.length) {
			showEmpty(container);
			return;
		}

		var total = rows.reduce(function (sum, item) {
			return sum + item.value;
		}, 0);
		var width = 440;
		var height = 245;
		var centerX = 130;
		var centerY = 122;
		var radius = 79;
		var innerRadius = 48;
		var angle = -Math.PI / 2;
		var svg = createSvg(container, width, height, title);

		rows.forEach(function (item, index) {
			var sweep = item.value / total * Math.PI * 2;
			var endAngle = angle + sweep;
			var outerStartX = centerX + radius * Math.cos(angle);
			var outerStartY = centerY + radius * Math.sin(angle);
			var outerEndX = centerX + radius * Math.cos(endAngle);
			var outerEndY = centerY + radius * Math.sin(endAngle);
			var innerEndX = centerX + innerRadius * Math.cos(endAngle);
			var innerEndY = centerY + innerRadius * Math.sin(endAngle);
			var innerStartX = centerX + innerRadius * Math.cos(angle);
			var innerStartY = centerY + innerRadius * Math.sin(angle);
			var largeArc = sweep > Math.PI ? 1 : 0;
			var color = palette[index % palette.length];
			var slice = svgElement(svg, 'path', {
				d: 'M ' + outerStartX + ' ' + outerStartY
					+ ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + outerEndX + ' ' + outerEndY
					+ ' L ' + innerEndX + ' ' + innerEndY
					+ ' A ' + innerRadius + ' ' + innerRadius + ' 0 ' + largeArc + ' 0 ' + innerStartX + ' ' + innerStartY
					+ ' Z',
				fill: color,
				stroke: '#fff',
				'stroke-width': '2'
			});
			var tooltip = document.createElementNS(svgNamespace, 'title');
			tooltip.textContent = item.name + ': US$' + decimalFormat.format(item.value) + 'k';
			if (item.respondents) {
				tooltip.textContent += ' · ' + numberFormat.format(item.respondents) + ' respondents';
			}
			slice.appendChild(tooltip);
			angle = endAngle;

			var legendY = 67 + index * Math.min(32, 144 / rows.length);
			svgElement(svg, 'rect', {
				x: 239,
				y: legendY - 9,
				width: 11,
				height: 11,
				rx: 2,
				fill: color
			});
			svgElement(svg, 'text', { x: 258, y: legendY }, item.name);
			svgElement(svg, 'text', {
				x: 258,
				y: legendY + 14,
				fill: '#81787a',
				'font-size': '10'
			}, 'US$' + decimalFormat.format(item.value) + 'k');
		});

		var centerAverage = rows.reduce(function (sum, item) {
			return sum + item.value * (item.weight || 1);
		}, 0) / rows.reduce(function (sum, item) {
			return sum + (item.weight || 1);
		}, 0);
		svgElement(svg, 'text', {
			x: centerX,
			y: centerY - 2,
			'text-anchor': 'middle',
			fill: '#6b2328',
			'font-size': '16',
			'font-weight': '700'
		}, '$' + decimalFormat.format(centerAverage) + 'k');
		svgElement(svg, 'text', {
			x: centerX,
			y: centerY + 16,
			'text-anchor': 'middle',
			fill: '#81787a',
			'font-size': '9'
		}, centerLabel);
	}

	function countryRows(roles) {
		if (isAllRolesSelected()) {
			return data.countries.map(function (item) {
				return { name: item.name, respondents: item.respondents };
			});
		}

		var selectedNames = roles.map(function (role) {
			return role.name;
		});
		var grouped = new Map();
		data.countryByRole.forEach(function (item) {
			if (selectedNames.indexOf(item.role) !== -1) {
				grouped.set(item.country, (grouped.get(item.country) || 0) + item.respondents);
			}
		});
		return Array.from(grouped, function (entry) {
			return { name: entry[0], respondents: entry[1] };
		});
	}

	function renderCountryChart(roles) {
		var container = document.getElementById('survey-country-chart');
		var rows = countryRows(roles).sort(function (a, b) {
			return b.respondents - a.respondents || a.name.localeCompare(b.name);
		}).slice(0, 8);

		if (!rows.length) {
			showEmpty(container);
			return;
		}

		var width = 620;
		var rowHeight = 31;
		var height = Math.max(170, rows.length * rowHeight + 16);
		var marginLeft = 152;
		var chartWidth = width - marginLeft - 38;
		var maximum = rows[0].respondents;
		var svg = createSvg(container, width, height, 'Survey responses by country');

		rows.forEach(function (item, index) {
			var y = 8 + index * rowHeight;
			var barWidth = item.respondents / maximum * chartWidth;
			svgElement(svg, 'text', {
				x: marginLeft - 8,
				y: y + 15,
				'text-anchor': 'end'
			}, item.name);
			var bar = svgElement(svg, 'rect', {
				x: marginLeft,
				y: y + 3,
				width: Math.max(1, barWidth),
				height: 19,
				rx: 3,
				fill: '#2D386D'
			});
			var tooltip = document.createElementNS(svgNamespace, 'title');
			tooltip.textContent = item.name + ': ' + numberFormat.format(item.respondents) + ' respondents';
			bar.appendChild(tooltip);
			svgElement(svg, 'text', {
				x: marginLeft + barWidth + 7,
				y: y + 16,
				'font-weight': '700'
			}, numberFormat.format(item.respondents));
		});
	}

	function renderDashboard() {
		var roles = getSelectedRoleRows();
		var summary = getSummary(roles);
		renderRoleFilters();
		renderMetrics(summary);
		renderGauges(summary);
		renderLanguageChart(roles);
		renderDonutChart(
			'survey-role-salary-chart',
			roleSalaryRows(roles),
			'Average annual salary by current role',
			'WEIGHTED AVG',
			colors
		);
		renderDonutChart(
			'survey-gender-salary-chart',
			genderSalaryRows(roles),
			'Average annual salary by gender',
			'WEIGHTED AVG',
			genderColors
		);
		renderCountryChart(roles);
	}

	root.addEventListener('click', function (event) {
		var button = event.target.closest('[data-role]');
		if (!button) {
			return;
		}

		var role = button.dataset.role;
		if (selectedRoles.indexOf(role) !== -1) {
			selectedRoles = selectedRoles.filter(function (name) {
				return name !== role;
			});
		} else {
			selectedRoles.push(role);
		}
		renderDashboard();
	});

	root.querySelector('[data-survey-role-reset]').addEventListener('click', function () {
		selectedRoles = data.roles.map(function (role) {
			return role.name;
		});
		renderDashboard();
	});

	renderDashboard();
}());
