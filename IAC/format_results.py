import os
import xml.etree.ElementTree as ET
import html
import re

def parse_junit_xml(xml_file):
    if not os.path.exists(xml_file):
        raise FileNotFoundError(f"No se encontró el archivo XML en: {xml_file}")
        
    tree = ET.parse(xml_file)
    root = tree.getroot()
    
    # Check if root is testsuites or testsuite
    testsuites = []
    if root.tag == 'testsuites':
        testsuites = root.findall('testsuite')
    elif root.tag == 'testsuite':
        testsuites = [root]
        
    summary = {
        'total': 0,
        'failures': 0,
        'errors': 0,
        'skipped': 0,
        'passed': 0
    }
    
    cases = []
    
    for suite in testsuites:
        summary['total'] += int(suite.attrib.get('tests', 0))
        summary['failures'] += int(suite.attrib.get('failures', 0))
        summary['errors'] += int(suite.attrib.get('errors', 0))
        summary['skipped'] += int(suite.attrib.get('skipped', 0))
        
        for case in suite.findall('testcase'):
            case_data = {
                'name': case.attrib.get('name', ''),
                'classname': case.attrib.get('classname', ''),
                'file': case.attrib.get('file', ''),
                'status': 'passed',
                'failure_message': '',
                'failure_detail': '',
                'policy_id': '',
                'description': '',
                'resource': '',
                'guideline': ''
            }
            
            # Extract Policy ID and description from name
            # Format: [NONE][CKV_AWS_136] Ensure that ECR...
            name_match = re.match(r'\[.*?\]\[(.*?)\]\s*(.*)', case_data['name'])
            if name_match:
                case_data['policy_id'] = name_match.group(1)
                case_data['description'] = name_match.group(2)
            else:
                case_data['description'] = case_data['name']
                
            # Classname usually points to the Terraform resource path
            case_data['resource'] = case_data['classname']
            
            failure = case.find('failure')
            if failure is not None:
                case_data['status'] = 'failed'
                case_data['failure_message'] = failure.attrib.get('message', '')
                detail_text = failure.text or ''
                case_data['failure_detail'] = detail_text
                
                # Try to extract guideline URL from detail text
                guideline_match = re.search(r'Guideline:\s*(https?://\S+)', detail_text)
                if guideline_match:
                    case_data['guideline'] = guideline_match.group(1)
            
            cases.append(case_data)
            
    summary['passed'] = summary['total'] - summary['failures'] - summary['errors'] - summary['skipped']
    if summary['passed'] < 0:
        summary['passed'] = len([c for c in cases if c['status'] == 'passed'])
        
    return summary, cases

def generate_html_report(summary, cases, output_file):
    # Calculate pass percentage
    total = summary['total']
    passed = summary['passed']
    failures = summary['failures']
    pass_rate = (passed / total * 100) if total > 0 else 0
    
    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=device-width, initial-scale=device-width">
    <title>Reporte de Seguridad Terraform - Checkov</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-main: #0b0f19;
            --bg-card: #151d30;
            --bg-card-hover: #1e2942;
            --border-color: #263554;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --color-pass: #10b981;
            --color-fail: #ef4444;
            --color-warn: #f59e0b;
            --color-accent: #3b82f6;
            --font-main: 'Outfit', sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }}
        
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        
        body {{
            background-color: var(--bg-main);
            color: var(--text-primary);
            font-family: var(--font-main);
            line-height: 1.6;
            padding: 2rem 1.5rem;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        header {{
            margin-bottom: 2.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }}
        
        h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }}
        
        .subtitle {{
            color: var(--text-secondary);
            font-size: 1rem;
            margin-top: 0.25rem;
        }}
        
        /* Stats Dashboard */
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.25rem;
            margin-bottom: 2.5rem;
        }}
        
        .stat-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        
        .stat-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        }}
        
        .stat-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--color-accent);
        }}
        
        .stat-card.pass::before {{ background: var(--color-pass); }}
        .stat-card.fail::before {{ background: var(--color-fail); }}
        .stat-card.rate::before {{ background: linear-gradient(to bottom, var(--color-accent), var(--color-pass)); }}
        
        .stat-label {{
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            font-weight: 500;
        }}
        
        .stat-value {{
            font-size: 2.25rem;
            font-weight: 700;
            margin-top: 0.5rem;
            display: flex;
            align-items: baseline;
        }}
        
        .stat-unit {{
            font-size: 1rem;
            color: var(--text-secondary);
            margin-left: 0.25rem;
        }}
        
        /* Controls & Filter */
        .controls-panel {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.25rem;
            margin-bottom: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }}
        
        @media (min-width: 768px) {{
            .controls-panel {{
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
            }}
        }}
        
        .filter-buttons {{
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }}
        
        .btn {{
            background: #1e293b;
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            font-family: var(--font-main);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}
        
        .btn:hover {{
            background: #334155;
            border-color: #475569;
        }}
        
        .btn.active {{
            background: var(--color-accent);
            border-color: var(--color-accent);
            color: white;
        }}
        
        .btn-pass.active {{
            background: var(--color-pass);
            border-color: var(--color-pass);
        }}
        
        .btn-fail.active {{
            background: var(--color-fail);
            border-color: var(--color-fail);
        }}
        
        .badge {{
            background: rgba(255,255,255,0.15);
            padding: 0.1rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }}
        
        .search-box {{
            position: relative;
            flex-grow: 1;
            max-width: 400px;
        }}
        
        .search-input {{
            width: 100%;
            background: #0b0f19;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 0.65rem 1rem 0.65rem 2.5rem;
            border-radius: 8px;
            font-family: var(--font-main);
            font-size: 0.95rem;
            transition: all 0.2s;
        }}
        
        .search-input:focus {{
            outline: none;
            border-color: var(--color-accent);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }}
        
        .search-icon {{
            position: absolute;
            left: 0.9rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            pointer-events: none;
        }}
        
        /* Test Cases List */
        .case-list {{
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }}
        
        .case-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            transition: border-color 0.2s;
        }}
        
        .case-card.passed-card {{
            border-left: 4px solid var(--color-pass);
        }}
        
        .case-card.failed-card {{
            border-left: 4px solid var(--color-fail);
        }}
        
        .case-header {{
            padding: 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            cursor: pointer;
            gap: 1rem;
        }}
        
        .case-title-area {{
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            flex-grow: 1;
        }}
        
        .case-meta {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }}
        
        .policy-badge {{
            font-family: var(--font-mono);
            font-size: 0.8rem;
            font-weight: 500;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }}
        
        .status-pill {{
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            padding: 0.15rem 0.5rem;
            border-radius: 12px;
        }}
        
        .status-pill.pass-pill {{
            background: rgba(16, 185, 129, 0.15);
            color: var(--color-pass);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }}
        
        .status-pill.fail-pill {{
            background: rgba(239, 68, 68, 0.15);
            color: var(--color-fail);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}
        
        .file-path {{
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-family: var(--font-mono);
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }}
        
        .case-description {{
            font-size: 1.05rem;
            font-weight: 500;
            color: var(--text-primary);
            margin-top: 0.25rem;
        }}
        
        .resource-path {{
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-family: var(--font-mono);
            margin-top: 0.25rem;
            background: rgba(15, 23, 42, 0.4);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.03);
            word-break: break-all;
        }}
        
        .toggle-icon {{
            font-size: 1.25rem;
            color: var(--text-secondary);
            transition: transform 0.2s;
            align-self: center;
            user-select: none;
        }}
        
        .case-card.expanded .toggle-icon {{
            transform: rotate(180deg);
        }}
        
        .case-body {{
            display: none;
            padding: 1.25rem;
            background: #0f1524;
            border-top: 1px solid var(--border-color);
        }}
        
        .case-card.expanded .case-body {{
            display: block;
        }}
        
        .failure-box {{
            background: #080c14;
            border-radius: 8px;
            border: 1px solid rgba(239, 68, 68, 0.2);
            padding: 1rem;
            margin-bottom: 1rem;
            overflow-x: auto;
        }}
        
        .failure-detail {{
            font-family: var(--font-mono);
            font-size: 0.9rem;
            color: #fca5a5;
            white-space: pre-wrap;
            word-break: break-word;
        }}
        
        .guideline-link {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--color-accent);
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            margin-top: 0.5rem;
            transition: color 0.2s;
        }}
        
        .guideline-link:hover {{
            color: #60a5fa;
            text-decoration: underline;
        }}
        
        .no-results {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 1.1rem;
            display: none;
        }}
        
        /* SVG Icons */
        .icon-svg {{
            width: 18px;
            height: 18px;
            fill: currentColor;
            display: inline-block;
            vertical-align: middle;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>
                    <svg class="icon-svg" viewBox="0 0 24 24" style="width: 28px; height: 28px; color: var(--color-accent);">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    Reporte de Seguridad IaC
                </h1>
                <p class="subtitle">Análisis estático de Terraform con Checkov</p>
            </div>
            <div>
                <span class="file-path" style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 8px;">
                    Archivo: results_junitxml.xml
                </span>
            </div>
        </header>
        
        <!-- Dashboard Statistics -->
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Pruebas</div>
                <div class="stat-value">{total}</div>
            </div>
            <div class="stat-card pass">
                <div class="stat-label">Exitosas (Pasadas)</div>
                <div class="stat-value" style="color: var(--color-pass);">{passed}</div>
            </div>
            <div class="stat-card fail">
                <div class="stat-label">Fallidas (Errores)</div>
                <div class="stat-value" style="color: var(--color-fail);">{failures}</div>
            </div>
            <div class="stat-card rate">
                <div class="stat-label">Porcentaje de Éxito</div>
                <div class="stat-value" style="background: linear-gradient(135deg, #fff 30%, var(--color-pass) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    {pass_rate:.1f}<span class="stat-unit">%</span>
                </div>
            </div>
        </section>
        
        <!-- Filtering and Controls -->
        <section class="controls-panel">
            <div class="filter-buttons">
                <button class="btn active" onclick="filterStatus('all')">
                    Todos <span class="badge">{total}</span>
                </button>
                <button class="btn btn-fail" onclick="filterStatus('failed')">
                    Fallidos <span class="badge" style="background: rgba(239,68,68,0.25);">{failures}</span>
                </button>
                <button class="btn btn-pass" onclick="filterStatus('passed')">
                    Pasados <span class="badge" style="background: rgba(16,185,129,0.25);">{passed}</span>
                </button>
            </div>
            <div class="search-box">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="searchInput" class="search-input" placeholder="Buscar por ID de regla, recurso o archivo..." oninput="handleSearch()">
            </div>
        </section>
        
        <!-- Results List -->
        <section class="case-list" id="caseList">
    """
    
    for i, case in enumerate(cases):
        is_failed = case['status'] == 'failed'
        card_class = "failed-card" if is_failed else "passed-card"
        pill_class = "fail-pill" if is_failed else "pass-pill"
        status_text = "Fallo" if is_failed else "Paso"
        
        policy_badge = ""
        if case['policy_id']:
            policy_badge = f'<span class="policy-badge">{html.escape(case["policy_id"])}</span>'
            
        toggle_arrow = ""
        if is_failed:
            toggle_arrow = """<span class="toggle-icon">▼</span>"""
            
        # Build Case Header click handler
        onclick_handler = f"toggleCard(this)" if is_failed else ""
        cursor_style = "style='cursor: pointer;'" if is_failed else "style='cursor: default;'"
        
        html_content += f"""
            <div class="case-card {card_class}" data-status="{case['status']}" data-search-text="{html.escape(case['policy_id'].lower())} {html.escape(case['description'].lower())} {html.escape(case['file'].lower())} {html.escape(case['resource'].lower())}">
                <div class="case-header" onclick="{onclick_handler}" {cursor_style}>
                    <div class="case-title-area">
                        <div class="case-meta">
                            <span class="status-pill {pill_class}">{status_text}</span>
                            {policy_badge}
                            <span class="file-path">
                                <svg class="icon-svg" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 2px;">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                                </svg>
                                {html.escape(case['file'])}
                            </span>
                        </div>
                        <div class="case-description">{html.escape(case['description'])}</div>
                        <div class="resource-path">Recurso: {html.escape(case['resource'])}</div>
                    </div>
                    {toggle_arrow}
                </div>
        """
        
        if is_failed:
            html_content += f"""
                <div class="case-body">
                    <div class="failure-box">
                        <pre class="failure-detail"><code>{html.escape(case['failure_detail'])}</code></pre>
                    </div>
            """
            if case['guideline']:
                html_content += f"""
                    <a href="{case['guideline']}" target="_blank" class="guideline-link">
                        <svg class="icon-svg" viewBox="0 0 24 24" style="margin-right: 4px;">
                            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                        </svg>
                        Ver guía de resolución oficial (Prisma Cloud)
                    </a>
                """
            html_content += """
                </div>
            """
            
        html_content += """
            </div>
        """
        
    html_content += """
        </section>
        
        <div class="no-results" id="noResults">
            No se encontraron resultados que coincidan con la búsqueda.
        </div>
    </div>

    <script>
        let currentFilter = 'all';
        
        function toggleCard(headerElement) {
            const card = headerElement.parentElement;
            card.classList.toggle('expanded');
        }
        
        function filterStatus(status) {
            currentFilter = status;
            
            // Update button styles
            const buttons = document.querySelectorAll('.filter-buttons .btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            const event = window.event;
            if (event) {
                event.currentTarget.classList.add('active');
            } else {
                // Fallback activation
                if (status === 'all') buttons[0].classList.add('active');
                if (status === 'failed') buttons[1].classList.add('active');
                if (status === 'passed') buttons[2].classList.add('active');
            }
            
            applyFilterAndSearch();
        }
        
        function handleSearch() {
            applyFilterAndSearch();
        }
        
        function applyFilterAndSearch() {
            const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.case-card');
            const noResults = document.getElementById('noResults');
            let visibleCount = 0;
            
            cards.forEach(card => {
                const cardStatus = card.getAttribute('data-status');
                const searchText = card.getAttribute('data-search-text');
                
                const matchesStatus = (currentFilter === 'all') || (cardStatus === currentFilter);
                const matchesSearch = !searchValue || searchText.includes(searchValue);
                
                if (matchesStatus && matchesSearch) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                    card.classList.remove('expanded');
                }
            });
            
            if (visibleCount === 0) {
                noResults.style.display = 'block';
            } else {
                noResults.style.display = 'none';
            }
        }
    </script>
</body>
</html>
"""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    xml_file = os.path.join(base_dir, 'results.xml', 'results_junitxml.xml')
    output_html = os.path.join(base_dir, 'results.xml', 'results_report.html')
    
    print(f"Leyendo XML de: {xml_file}...")
    try:
        summary, cases = parse_junit_xml(xml_file)
        print(f"XML parseado con éxito. Total pruebas: {summary['total']}, Falladas: {summary['failures']}, Pasadas: {summary['passed']}.")
        
        print(f"Generando reporte HTML en: {output_html}...")
        generate_html_report(summary, cases, output_html)
        print("¡Reporte generado con éxito!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
