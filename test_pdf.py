import fitz

doc = fitz.open(r'C:\Users\pesoa\MoneyControl-main\bancosCSV\mercadopago.pdf')
for pnum, page in enumerate(doc):
    blocks = page.get_text('dict')['blocks']
    for block in blocks:
        if 'lines' not in block:
            continue
        for line in block['lines']:
            y = round(line['bbox'][1], 1)
            text = ''.join([span['text'] for span in line['spans']])
            print(f"Y={y}: {text}")
    if pnum < len(doc) - 1:
        print('--- PAGE BREAK ---')
