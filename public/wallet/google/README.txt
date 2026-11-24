Google's official "Add to Google Wallet" badges (primary variant, black), unmodified, as <lang>.svg (en, he, ru, fr, es),
downloaded from the Google Pay and Wallet brand guidelines (developers.google.com/wallet, "Download assets - SVG"):
en = enUS, fr = frFR, es = esES. Minimum height 48dp with 8dp clear space on every side; never recolour, mirror or restyle.
<lang>.png are 3x renderings of those SVGs (the website's <img>); the app's 1x/2x/3x bitmaps are in landly-mobile/assets/wallet/.
Regenerate all of them, and the pass images below, with: node scripts/generate-wallet-assets.mjs
logo.png (660x660, the white mark on transparent) and hero.png (1032x336, the navy brand banner) are the Google Wallet pass's
logo and hero: public https URLs Google fetches when a pass is saved (lib/wallet/googlePass.ts). They must be deployed to
www.golandly.com (or the origin named by WALLET_ASSET_ORIGIN) before a pass can be saved.
