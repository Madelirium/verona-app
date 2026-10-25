"""Slice the user-provided four sheets into the 40 playing-card assets."""
import sys
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from PIL import Image

target = Path(__file__).resolve().parent.parent / 'public/assets/cards/venete'
target.mkdir(parents=True, exist_ok=True)
columns = [(15, 287), (301, 575), (588, 862), (874, 1149), (1161, 1435)]
rows = [(12, 511), (524, 1053)]
with ZipFile(sys.argv[1]) as archive:
    for suit in ['denari', 'coppe', 'spade', 'bastoni']:
        sheet = Image.open(BytesIO(archive.read(suit.capitalize() + '.png'))).convert('RGB')
        if sheet.size != (1448, 1086):
            raise ValueError(f'Unexpected sheet dimensions: {suit} {sheet.size}')
        for rank in range(1, 11):
            left, right = columns[(rank - 1) % 5]
            top, bottom = rows[(rank - 1) // 5]
            card = sheet.crop((left, top, right, bottom))
            card.save(target / f'{suit}-{rank}.webp', 'WEBP', quality=85, method=6)
print('Prepared 40 cards in', target)
