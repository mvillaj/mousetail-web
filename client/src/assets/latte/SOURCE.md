# Coach card rosetta

`rosetta-mask.webp`: the milk of a rosetta latte-art pour, as white with an alpha channel. The coach card uses it as a CSS mask filled with the card's ink colour, so only its shape (not its colour) reaches the page.

- Source: a top-down photo of a rosetta in a cup, supplied by the owner on 2026-11-24 as a 1254×1254 WebP. Photographer and licence not yet recorded: add them here.
- Derivative: milk separated from coffee by how orange each pixel is (red minus blue: milk sits near 0–30, coffee near 180–220), mapped to alpha with a smooth ramp from 150 down to 45; everything outside a 492 px radius round the cup's centre (617, 620) faded out over 30 px to drop the rim and the white background; cropped to the art and resized to 640 px wide. WebP, quality 80, alpha quality 70.
