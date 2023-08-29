

from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader('templates'))

template = env.get_template('report_template.html')

html = template.render( titlepage = 'RansomMailDefender',
                        titlelogo = 'RansomMailDefender',
                        reporth1 = 'Report',
                        cat1 = 'Virus',
                        cat2 = 'WannaCry',
                        cat3 = 'Ransomware',
                        contenttext = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec ac sem malesuada, gravida urna sit amet, imperdiet velit. Proin a fermentum ex. Fusce egestas finibus tortor vel blandit. Integer in elit sit amet odio elementum finibus. Maecenas suscipit mi non libero cursus, sed commodo ligula ullamcorper. Fusce sagittis sit amet augue vitae scelerisque. Duis dignissim, elit non venenatis dapibus, tellus justo pretium justo, in finibus neque augue ac mauris. Quisque risus ante, sodales vel sapien a, ornare interdum est.')

with open('generated_report.html', 'w') as f:
    f.write(html)