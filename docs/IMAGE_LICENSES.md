# Guest hero photo licences (internal)

The forty-two photographs in the guest landing's diagonal marquee (`components/landing/DiagonalImageMarquee.tsx`): 14 in each of the three desktop columns and 21 in each of the two mobile ribbons, no photo in two tracks. The category rail photos are documented separately in [CATEGORY_IMAGES_LICENSES.md](./CATEGORY_IMAGES_LICENSES.md).

- Licence: [Unsplash License](https://unsplash.com/license): free for commercial use, no permission or credit required. It does not cover trademarks, or the likeness of identifiable people for endorsement.
- Files: `public/images/hero-marquee/{name}.webp` (720x960) and `{name}-sm.webp` (480x640), both 3:4. The first twelve were made with `sips` (crop, resize) and `cwebp` (quality 78 and 76) from the 1800px JPEG that `images.unsplash.com/photo-{Image id}` serves. The other thirty were made with `sharp` (3:4 crop around a per-photo focal point, Lanczos resize, WebP quality 78 and 76) from a 2400px master: the Unsplash CDN JPEG (`images.unsplash.com/photo-{Image id}?w=2400`) or, for the five Commons photos, the Commons thumbnail at up to 2400px. Self-hosted: nothing is hotlinked.
- Policy: the beach and promenade photos must be verified Tel Aviv locations; every other photo must show no identifiable face (hands, tables, objects, backs, silhouettes). Unsplash provides no model releases. Unsplash+ and Getty/iStock photos are not used. Every new Israeli landscape and landmark photo carries an Israel location tag on its page. The four nightlife and bar photos (`party-a`, `party-b`, `bar-a`, `bar-b`) are **not verified as Israeli**: Unsplash and Pexels have no faceless party or bar photo with an Israeli location tag, so these four are generic, faceless nightlife and bar scenes, flagged as such in the table.
- Pages: `beach`, `life`, `cafe`, `market` were read on **2026-11-14**, the other eight, and all thirty new photos, on **2026-11-16**. Each states "Free to use under the Unsplash License". Unsplash blocks headless browsers and plain `curl`, so the pages were read through a page-fetch tool; the image files came from the image CDN, and every photo was looked at after cropping.

| File | Subject | Place | Photographer | Photo page | Image id | Licence checked | Faces |
|---|---|---|---|---|---|---|---|
| `beach` | Jaffa beach, old city on the hill, turquoise sea (cropped 3:4 from the 4:3 original, right of centre) | Tel Aviv-Yafo (Homat HaYam promenade), verified | Pontus Wellgraf | https://unsplash.com/photos/people-on-the-beach-photography-7_2Peqe4rPs | `1556861458-41759cadc36f` | 2026-11-14 | Beach figures tiny and distant |
| `life` | Tel Aviv promenade, palms and sea (cropped 3:4 from the portrait original) | Tel Aviv, verified | Levi Meir Clancy | https://unsplash.com/photos/a-group-of-people-walking-down-a-sidewalk-next-to-the-ocean-RH154P_F9jw | `1631596894729-4c8d7463bd61` | 2026-11-14 | Walkers small and turned away |
| `cafe` | Croissants and a Tel Aviv street seen through a sunlit café window (cropped 3:4 from the left of the 16:9 original) | Tel Aviv | Vladimir Visotsky | https://unsplash.com/photos/a-bakery-counter-filled-with-pastries-next-to-a-window-wsj7uJh7Iec | `1681838675906-b91be4457fb1` | 2026-11-14 | No people |
| `market` | Pomegranates and mandarins at a market stall (cropped 3:4) | Mahane Yehuda Market, Jerusalem | Ilanit Ohana | https://unsplash.com/photos/a-pile-of-pomegranates-sitting-on-top-of-a-pile-of-orange-EP5xFvnM36o | `1645028846887-910d7daff99f` | 2026-11-14 | One blurred, masked passer-by far behind the fruit |
| `mezze-plate` | Salad plate with figs and pomegranate seeds, bread basket (cropped 3:4) | Not stated on the page | Louis Hansel | https://unsplash.com/photos/IgGFGxULsWg | `1542528180-0c79567c66de` | 2026-11-16 | No people |
| `dinner-wine` | Pasta, a glass of red wine and a hand with dark nail polish (cropped 3:4) | Not stated on the page | Doğu Tuncer | https://unsplash.com/photos/a-plate-of-food-and-a-glass-of-wine-MzqVY7Kh-e0 | `1681219916725-729678a6c949` | 2026-11-16 | A hand only; no face |
| `wellness-studio` | Yoga mats and a block in a bright modern studio (uncropped, 3:4) | Not stated on the page | eran design | https://unsplash.com/photos/yoga-mats-and-props-in-a-modern-studio-PS2aiW-YOJI | `1761971975858-c487bc10daab` | 2026-11-16 | No people |
| `wellness-corner` | Rolled yoga mats in a woven basket with plants (cropped 3:4) | Not stated on the page | Margaret Young | https://unsplash.com/photos/rolled-yoga-mats-in-a-woven-basket-with-plants-ZySBZ2_XS2A | `1767605545968-a102fc151b08` | 2026-11-16 | No people |
| `boutique-interior` | Boutique with a mannequin, dresses on a rail and lounge chairs (cropped 3:4) | Not stated on the page | Caroline Badran | https://unsplash.com/photos/a-boutique-clothing-store-interior-with-dresses-and-accessories-wNudbCFp78k | `1769107805511-0bb7075fca27` | 2026-11-16 | A mannequin only; no people |
| `fashion-rack` | Orange and floral blouses on a rail against a teal wall (cropped 3:4) | COS, Kuala Lumpur, Malaysia (per the page) | Marcus Loke | https://unsplash.com/photos/assorted-color-shirt-lot-hang-on-rack-xXJ6utyoSw0 | `1532453288672-3a27e9be9efd` | 2026-11-16 | No people |
| `rooftop-bar` | Rooftop bar terrace at night, neon and stools (uncropped, 3:4) | Penang, Malaysia (per the description) | Ryan Liu | https://unsplash.com/photos/rooftop-bar-at-night-with-neon-lights-FrLPeW1urbQ | `1758165532022-a68f291317ba` | 2026-11-16 | No people |
| `cocktail-bar` | Coupe glasses and a lamp on a bar counter (cropped 3:4) | Not stated on the page | Taylor Friehl | https://unsplash.com/photos/cocktails-sit-on-a-bar-with-blurry-background-people-3RftOW9F8b0 | `1754490928914-12a0482edef5` | 2026-11-16 | Background figures heavily blurred, no identifiable face |
| `masada-a` | Ruins of Masada seen from above (cropped 3:4) | Masada, Israel (page location tag) | Kelly Repreza | https://unsplash.com/photos/CBmC9RusfMo | `1593995774667-437a7378cfb2` | 2026-11-16 | No people |
| `masada-b` | Masada fortress edge above the Dead Sea haze (cropped 3:4) | Masada National Park, Israel (page tag) | Robert Bye | https://unsplash.com/photos/gjAsdMw--pU | `1466175207584-5a5a2a27113e` | 2026-11-16 | No people; at most a tiny distant figure |
| `masada-c` | Judean desert canyon beside Masada (cropped 3:4) | Masada, Israel (page tag) | aes | https://unsplash.com/photos/8bYDKLcdOCQ | `1674003487182-cf742fd71bd0` | 2026-11-16 | No people |
| `deadsea-a` | Aerial view of salt crust swirls on the Dead Sea (cropped 3:4) | Dead Sea, Israel (page tag) | Tim Mossholder | https://unsplash.com/photos/b7iVDLIWgEU | `1554335563-ac58db9d83a3` | 2026-11-16 | No people |
| `deadsea-b` | Aerial view of a turquoise Dead Sea lagoon and shore road (cropped 3:4) | Dead Sea Region, Israel (page tag) | Craig Vodnik | https://unsplash.com/photos/y31N5pcfLXs | `1601668246782-863c9c89a095` | 2026-11-16 | No people |
| `deadsea-c` | Golden desert sands above a green-tinted Dead Sea (cropped 3:4) | The Dead Sea, Israel (page tag) | Sammy Leigh Scholl | https://unsplash.com/photos/eTa53Uf0StE | `1478028336919-e8e8dcee1975` | 2026-11-16 | No people |
| `deadsea-d` | Empty road beside a Dead Sea cliff (cropped 3:4) | Dead Sea Region, Israel (page tag) | Gabriel Ghnassia | https://unsplash.com/photos/5xR3Tmret2U | `1437750851402-add7f4f28c0e` | 2026-11-16 | No people |
| `western-wall-a` | Stone courses of the Western Wall (Kotel) and an Israeli flag under a blue sky (cropped 3:4, left of centre) | Western Wall, Jerusalem (page location tag "Western Wall, Jerusalén") | Ilanit Ohana | https://unsplash.com/photos/jMryMiaecss | `1645028698158-38a209b07b1d` | 2026-11-16 | No people |
| `jerusalem-b` | Jerusalem skyline and the Mount of Olives at sunset (cropped 3:4) | Jerusalem (page tag "Jérusalem, Israël") | Nicolas Jehly | https://unsplash.com/photos/6YThfy8q9hE | `1781790235056-f01fce623a1e` | 2026-11-16 | No people |
| `jerusalem-c` | Old City seen from the Mount of Olives under clouds (cropped 3:4) | Mount of Olives, Jerusalem (page tag) | Robert Bye | https://unsplash.com/photos/6PLB5SKWiIY | `1466175743059-5393a020726c` | 2026-11-16 | No people |
| `mahane-yehuda-a` | Trays of sugar-dusted Hanukkah doughnuts (sufganiyot) and rolls at a bakery stall (cropped 3:4) | Mahane Yehuda Market, Jerusalem (page location tag) | Elisheva G | https://unsplash.com/photos/nyekPQwZbgw | `1543876604-b8ac0e7ded00` | 2026-11-16 | No people |
| `hermon-a` | Snow-covered slope with a mountain road (cropped 3:4) | Mount Hermon, Majdal Shams, Israel (page tag) | John Adeoye | https://unsplash.com/photos/65e_3uVvf4k | `1648584383976-48da8181d2d9` | 2026-11-16 | No people |
| `ramon-a` | Star trails over a lit cliff face, portrait (uncropped, 3:4) | Selina Ramon, Mitzpe Ramon, Israel (page tag) | Yoav Aziz | https://unsplash.com/photos/Z0SiTurRQAU | `1662960126803-02048050f381` | 2026-11-16 | No people |
| `ramon-b` | A desert road winding through the Negev, from above (uncropped, 3:4) | Mitzpe Ramon, Israel (page tag) | Yoav Aziz | https://unsplash.com/photos/OlOKSFDKL6I | `1662961345124-c8f747c38181` | 2026-11-16 | No people |
| `negev-a` | Layered Negev desert mountains (cropped 3:4) | Negev Mountains (page tag) | Avi Theret | https://unsplash.com/photos/HhhUZxsO_Ak | `1633088926847-435cdb7e76da` | 2026-11-16 | No people |
| `eilat-a` | The Edom Mountains across the Arava from Eilat, teal sky (cropped 3:4) | Eilat, Israel (page tag) | Avi Theret | https://unsplash.com/photos/Afk_lHBlVxw | `1596034063901-7a9ed93eccac` | 2026-11-16 | No people |
| `eilat-b` | Striped fish around bare legs, underwater (cropped 3:4) | Red Sea, Eilat, Israel (page tag) | Vitaliy Paykov | https://unsplash.com/photos/-65f1yUFhCs | `1567073161926-d6179e60492f` | 2026-11-16 | Bare legs only; no face |
| `galilee-a` | Sea of Galilee and Tiberias from the hills above (cropped 3:4) | Israel National Trail, Tiberias, Israel (page tag) | Thalia Tran | https://unsplash.com/photos/JO5qXKgGjkQ | `1541472786608-c495aa7b5f17` | 2026-11-16 | No people |
| `galilee-b` | Calm blue water with the far shore of the Sea of Galilee (cropped 3:4) | Sea of Galilee, Israel (page tag) | Jayson Boesman | https://unsplash.com/photos/KmoQeNg1zc4 | `1678134017317-4edd53da833d` | 2026-11-16 | No people |
| `tlv-a` | Jaffa and the curved Tel Aviv coast from the air, evening (cropped 3:4) | Jaffa Harbour, Israel (page tag) | Shai Pal | https://unsplash.com/photos/lpQwaLWhw9Q | `1547483036-24bc77c79804` | 2026-11-16 | No people |
| `tlv-b` | Tel Aviv skyline and beach under a blue sky (cropped 3:4) | Tel Aviv-Yafo, Israel (page tag) | Dan Gold | https://unsplash.com/photos/qgvFR8VkPss | `1528791075103-b149f525eb22` | 2026-11-16 | No people; no beachgoers at this size |
| `party-a` | A raised hand in silhouette against amber stage beams (uncropped, 3:4) | **Not stated; location unverified, not confirmed as Israel** | Joshua Hoehne | https://unsplash.com/photos/oqT3wEEu3ds | `1755152825416-a7b660d3bf1c` | 2026-11-16 | Silhouettes only; no face |
| `party-b` | Red stage lights over a silhouetted crowd (cropped 3:4) | **Porto, Portugal per the page; not Israel** | David Magalhães | https://unsplash.com/photos/hunYJNQZAio | `1767289394567-b5e4b5986c88` | 2026-11-16 | Silhouettes only; no face |
| `bar-a` | Pink neon sign on a dark bar counter (cropped 3:4) | **Not stated; location unverified, not confirmed as Israel** | Jason Leung | https://unsplash.com/photos/wlwXvUFIuyA | `1692731753558-f7913c3e0076` | 2026-11-16 | No people |
| `bar-b` | A cocktail with mint beside whiskey bottles on a bar counter (cropped 3:4) | **Vienna, Austria per the page; not Israel** | Ralph Darabos | https://unsplash.com/photos/swkwxyaBFto | `1547146598-0962d0d87c97` | 2026-11-16 | No people |

## Wikimedia Commons photos (CC BY-SA 4.0)

Five photos (`banias-a`, `banias-b`, `banias-c`, `jordan-a`, `jordan-b`) are from [Wikimedia Commons](https://commons.wikimedia.org) because Unsplash and Pexels have no usable photo of the Banias (Hermon stream) falls or the Jordan River in Israel. All five are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): free for commercial use if the author is credited, a link to the licence is given, changes are indicated, and the adapted file stays under the same licence. The files here are **adaptations**: cropped to 3:4, resized and re-encoded as WebP. Credit is kept in this file only, by decision; the public pages carry no third-party credit block. Author names, licence and dates were read from the Commons API (`extmetadata`) on 2026-11-16.

| File | Title on Commons | Author | Licence | Commons page | Taken | Subject / place | Faces |
|---|---|---|---|---|---|---|---|
| `banias-a` | Banias Fall on Khermon River 12.jpg | Hoshvilim | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:Banias_Fall_on_Khermon_River_12.jpg | 2013-01-16 | Rapids of the Hermon stream (Banias falls), Banias Nature Reserve, Golan | No people |
| `banias-b` | Banias Fall on Khermon River 13.jpg | Hoshvilim | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:Banias_Fall_on_Khermon_River_13.jpg | 2013-01-16 | White water in the Banias gorge | No people |
| `banias-c` | Banias river (5).jpg | עומר מרקובסקי (Omer Markovsky) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:Banias_river_(5).jpg | 2015-09-14 | The Banias waterfall and pool under plane trees (cropped 3:4) | No people |
| `jordan-a` | Yardenit, Degania, Jordan river 2.jpg | עומר מרקובסקי (Omer Markovsky) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:Yardenit,_Degania,_Jordan_river_2.jpg | 2012-04-21 | The Jordan River below the Sea of Galilee at Yardenit, eucalyptus banks (cropped 3:4, right of centre) | No people |
| `jordan-b` | ISRAEL - Yardenit, Jordan River (1).JPG | Britchi Mirela | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | https://commons.wikimedia.org/wiki/File:ISRAEL_-_Yardenit,_Jordan_River_(1).JPG | 2014-10-18 | The Jordan River at Yardenit, dark green water between trees (cropped 3:4, left of centre, so the people at the bottom right edge of the original are out of frame) | No people |

The earlier 2x2 gallery (`public/images/hero/`, four 1200px and 640px landscape crops of `beach`, `cafe`, `market` and `life`) was replaced by this set; those four photos are the same Unsplash photos, re-cropped to 3:4, so the old files were removed.

## SHA-256 (shipped files)

| File | SHA-256 |
|---|---|
| `beach.webp` | `3bc324cddaecdfc525e1964d47ee1b50698d67442d83b71f1bbac09e50b56ac0` |
| `beach-sm.webp` | `d8f2c442382ce956130147a3d7aa4424474d63cb2d7473bbb72c3512480b4e4e` |
| `life.webp` | `e7d14f79415fddad21bfc6689ccddcc1b720f5c7919b01ea0ae6cadb8ea9699f` |
| `life-sm.webp` | `c1a99ce86a6fd26ed136b555baf8a8913ccd494a7c6f19c26f4b1e1fb93b849a` |
| `cafe.webp` | `1dfec6a0d82c0596221c35df32f01a29e1da60f4ae2785e2e49d6372d5fc73bb` |
| `cafe-sm.webp` | `9fb64cc9bbe54440bddc855d232e7fdbb0d4b353d4040713f1e995c51c937cf1` |
| `market.webp` | `9c50ff28415796ee44159a0700df7c007b78815d953fcc7ef54deeeebeb7f280` |
| `market-sm.webp` | `8f63b09cb2a2649bb3a2320e55b4df1e87ae00d9bc9380f7b5c498294c2f1966` |
| `mezze-plate.webp` | `47c1de1431eae5ede57720b045913ea4e6d3d55fdf73cdb8ccd4a59352a7b591` |
| `mezze-plate-sm.webp` | `5579c50ac455fbcf94b94cf1d9be038f3016daa7b0a7b82a5d3327b12c3be787` |
| `dinner-wine.webp` | `1ce61d8bdfa5b8183337504c6a6c22f17559d8394b7c36a5bc94d18149b6f5a7` |
| `dinner-wine-sm.webp` | `4f040e75e6d900874547e8552f3f47660e5c8075ac1d51abf60dd9165f78b438` |
| `wellness-studio.webp` | `39c6042bbc291df2270018d6267ba4c99273bb47670954abfa31f0621c4bbd84` |
| `wellness-studio-sm.webp` | `2d7327981357377b63e0dd4a305389286c3cc314e8973495c72a273cc998a9e2` |
| `wellness-corner.webp` | `3e4426ed24a38f3081ebbb1266a218dede2c598e2bd9fead405ec9ee4d35f9d5` |
| `wellness-corner-sm.webp` | `1697850bdcce5d957f87da2c08859a57385c0f0f6acb83502e3f968448e52e09` |
| `boutique-interior.webp` | `ecf1f889356be3261e22935279d1a554b1bfa118cd080e5861ff365257c1480a` |
| `boutique-interior-sm.webp` | `c45e65598ab0fe0fd93b6d5acfd6659f6830298dfe7ce8d579678ac673464707` |
| `fashion-rack.webp` | `41fe81ad4cc12328c26d5b25da3e896219fc6e9bdd7fdab993e47de9fb936e8c` |
| `fashion-rack-sm.webp` | `5edd0c24b616ae41ebf2bbdbd418410e6bd514b85073dbd17d7d4b024d01c5f2` |
| `rooftop-bar.webp` | `b1c837ceb6d276848d633998a1dea87ee94fe4d94fd4cae5711b1eeddf7cab3c` |
| `rooftop-bar-sm.webp` | `85cc54599756c577ef1bddd47fe315eb9541ff39e6f81189af713c0e5d2c92ac` |
| `cocktail-bar.webp` | `e24439bacb08877b24b4e9892917949f45248904d79e9cabe1124df6f2e4cbbb` |
| `cocktail-bar-sm.webp` | `dca609136af1747f850ee047f1de8aeed13d29b340aba35e5437bb04f19ce118` |
| `masada-a.webp` | `fed466c25152a42a28c05f85ccad80574aed6d2072ff84c28fe86f22fb104903` |
| `masada-a-sm.webp` | `acedb371814cf9332fdd39ca9c484adbdb0f94f5af4014db044aafdddf79e8b0` |
| `masada-b.webp` | `4c3fb486a680928f0682152fbc8ba76be189e6e24abdc610c35b310845402223` |
| `masada-b-sm.webp` | `8ad61939a48be903899b9e5ba2a76e8db9c219f605eac7f01bd8f012953ef202` |
| `masada-c.webp` | `88d29628567317ff6764324d4597789e6dc4f416b60eb958886cf54c248026cc` |
| `masada-c-sm.webp` | `450465488ac492f812c03af834a4adbf7df70b6679caaf3968f6cb80e9d26105` |
| `deadsea-a.webp` | `8c5cb90ce715bceb28701063d24cdc8e246a99b7d5b8e6a09709fb117b16e655` |
| `deadsea-a-sm.webp` | `94795a1ae55a286b9de3bade712bbae46b0f280a92e62dd495b3ec7033226f51` |
| `deadsea-b.webp` | `48893a42f675bdc5c2227452b28d0266d205b9fa289e59a8f3c3a78773dac8da` |
| `deadsea-b-sm.webp` | `a94a5bcfbde539baa78be65d9f37b27fd38e4a2a2cee88d3258fdb74d67074b7` |
| `deadsea-c.webp` | `ff19056ed6d46f5167c45846d3b9271c6174a03b4bfb4e0ab1bcf8a38d66ab0d` |
| `deadsea-c-sm.webp` | `07bf77aa39715abfca2595a542644f400817f98eca47c55aea9847c1177ca796` |
| `deadsea-d.webp` | `65858519c39843e9ef511f3a0f1434b0a73db2c8d6daef91767d70f4a3c5c7bb` |
| `deadsea-d-sm.webp` | `eda916a73e4e82f196ca1a9f5a08c6b74adafb0bc14d3682ad13a4b4d98fcd31` |
| `western-wall-a.webp` | `ea9d915b0030329ce77df9f00184b67cba42c261a8d7a91b24ea30ab4c206ae8` |
| `western-wall-a-sm.webp` | `afd912f21e4181d692b33ebedccb39c4ddf77033840d1625e4c04caaacf973f2` |
| `jerusalem-b.webp` | `2bf7c75884e82810dff4409e07465b6f93e1c3ceb7887477088c301040b0f446` |
| `jerusalem-b-sm.webp` | `a73a12f29785445c6196ded95a19a1a2de78bf98b71c64890512bee0a9e730b8` |
| `jerusalem-c.webp` | `7053ee623fb3cb01f50afc82e395ee92e7594d90d2783203466d6ec344d5de5e` |
| `jerusalem-c-sm.webp` | `dd6c095764ac76bc65bbc6c3a0961911a0e6e5db448a0366bbb7cd24b9c07741` |
| `mahane-yehuda-a.webp` | `e7c1003290e58dd58888715a871e99ac480952cb569dacacacb79ede1c0b4e99` |
| `mahane-yehuda-a-sm.webp` | `f627cb53f419ffaba44b1f8f6e2c6bbf7b4aca020eb607cbde3f78a0e2f62837` |
| `hermon-a.webp` | `49b4ee74c0cab7692d94ab74e5d326e3fbd8fd63af5b6464b42cc443bf250602` |
| `hermon-a-sm.webp` | `6e05cac029aef24c87568fc318e7dc761bba64140df36262031eae2ab458e76a` |
| `ramon-a.webp` | `95c0418fc7165bb46bdb26be325e678808b0a8488ab582df2bf7d568f03cb726` |
| `ramon-a-sm.webp` | `c40505a8a2ffdabf6df7de83dd78febfea84c4cc1e2cc3699b54235af52c75ae` |
| `ramon-b.webp` | `3d5a4b6175e9ce36660451d20320e8165fb0a17d831ba82f63ee94b3d1149934` |
| `ramon-b-sm.webp` | `1b8b27eac6761134a76ce2608975205cc28d5366b59f726bd233f6f3881ed975` |
| `negev-a.webp` | `4ccdbf33b519ed8c9a9ca622403fb81ec73adba1c824c90cd3601bc27cc07a78` |
| `negev-a-sm.webp` | `9bc41a2bebaec4366d0eeade08028f475f031901219f57cbc39fe30d8bbf7682` |
| `eilat-a.webp` | `0bd65177b881f61243f3b7b1929c86132532dfde37a1873128a8f220b1bb9547` |
| `eilat-a-sm.webp` | `12cded6fc26bf15d241243851df7f90ebbf2a60b48425b51bcd21589fe793051` |
| `eilat-b.webp` | `d14a746b5e4dc5b2717d3c125930a59ad45ade27f4b06caadcd2bca16089691f` |
| `eilat-b-sm.webp` | `c352ef6ebb8b8ee8b56c1e9187006cad82c1f43822357b10d8b1cc876e41d105` |
| `galilee-a.webp` | `a8911d5796224a19c8a75811d916ccc86f498a43440e063cd9360bf76b01b249` |
| `galilee-a-sm.webp` | `0b5ac0d4d1ca7b7510075c6b36b9fbad49862f0c1bfb0574e7c64a6375661569` |
| `galilee-b.webp` | `28b20fa46f3e20f74e0709478272750d9aaaaf4f76c2ab2b2a5a144875961620` |
| `galilee-b-sm.webp` | `3f53bd67d34ab9c9a13c12f3cec9c52a9f89b75c66ff41242c0a4f923d45e11b` |
| `tlv-a.webp` | `ee4e61e5e551ed6857b096e3985fad4c6c2afbe3d72093403fe159138bb295dc` |
| `tlv-a-sm.webp` | `604b355a4832f938ac374ecf7711f37337107e8aed1dea80af3d905433ca8c8f` |
| `tlv-b.webp` | `7819eb69da1fa015085f36e1a56cd85689998577e9760f8fe415167d942b6789` |
| `tlv-b-sm.webp` | `ea54fc7603a9c2146f0bd31da44f7f46ee82b16f3cb875e9f5948835b426e995` |
| `banias-a.webp` | `2ea09c7f790d346e8fd231b7b300310fc6df7b0173c752e9fa6c3c43c5c5276f` |
| `banias-a-sm.webp` | `047fd4c2fa47ca08af8396b7d743a9bf84b034781a047effb5d25b4f6e5db8fa` |
| `banias-b.webp` | `dc47896d77bee89c48ed8c1b9f5a9ee451616e54dcf0116beac2565a10fcc9e4` |
| `banias-b-sm.webp` | `1543001fc70c1f75cc51a0a68ba9709300a4a8ea359da94ea55fc2d80d16f5b1` |
| `banias-c.webp` | `43ee7cfc68fb11a682caa119e73852c0db7d800291264ebd301f4d9509746815` |
| `banias-c-sm.webp` | `7f77205ec3dfba14f96b545ee59ab238750a7bac986e7a49315a966484a3f5c5` |
| `jordan-a.webp` | `7d3300f840a89807bfbd40ec9b09420f6f836525b0ccec0c3db32ace6e83422e` |
| `jordan-a-sm.webp` | `9d47f55d6165557c1ff2b6716e505a0cfacaf85f1452f4fd802a4d3f61d382d0` |
| `jordan-b.webp` | `2d99cc5574b9da74bdf195a701dadc03d0a5d5243d2eb5e77f0a5092934f5566` |
| `jordan-b-sm.webp` | `a2803902be995b22ff397c1263efdfd30eac468a76cfd4710ed0089a0318f872` |
| `party-a.webp` | `e01833e717efa548a28a26b510ada63d63ccee6c8c34c6444cf6162f1fa2b34f` |
| `party-a-sm.webp` | `b3f03a711e5d70f42465490d42c6aa55609421ad59bc9eb91221888e2ae986dd` |
| `party-b.webp` | `cae551e46dec70c824862aa9e42c4dd963a2607a2116c0948301774883ae4de8` |
| `party-b-sm.webp` | `acbfca7502fb2e3545f62bfd95945702f3192e529a4ac685f094e76b8c52d6ca` |
| `bar-a.webp` | `92f0db751606a9a6b521f1c55794922fb608bdccdf8be998db2f03d0a727b5b2` |
| `bar-a-sm.webp` | `95084c58a8fd7888eae83868cbd930cd219aba969ec79b14c2d9efb9cb98ff09` |
| `bar-b.webp` | `9dcc3a16a54d271290c25ab87ebda7263f06995ce997bebc2e61f99b80cb4fe1` |
| `bar-b-sm.webp` | `5a8cb76515cf6f79704f6dd6c6b3689ccd860d9255540b512380344906e23f02` |

To change a photo: replace both files, update the rows and hashes here, and run `shasum -a 256 public/images/hero-marquee/*.webp`.

## Raayonit brand images recovered from official sites

Only the business's own website (`official_website`, or the website its Google Business listing names: `google_business_listing_website`) is a source. Social platforms (Instagram, Facebook, TikTok, Pinterest, X, LinkedIn, YouTube and their CDNs) and stock agencies are refused by `isBlockedImageSource` (lib/inventory/raayonitImageUtils.ts). Google's own listing photos are not downloaded.

| Business | Key | Source URL | Origin |
|---|---|---|---|
| יו | `l-u-hotels` | https://assets.fattal.co.il/24_f75f04f310.jpg | official_website |
| קאסה דל פפה | `l-8981` | https://casadelpepetlv.maxshop.co.il/uploads/4964e6c957198dee8/17502424110464.png | google_business_listing_website |
| מלון סטאי תל אביב | `l-10319` | https://thesetaihotels.com/wp-content/uploads/2022/11/Logo-group-en3.svg | official_website |
| מלון סטאי כנרת | `l-5062` | https://thesetaihotels.com/wp-content/uploads/2022/11/Logo-group-en3.svg | official_website |
| VERT | `l-vert` | user_provided:vert.webp | user_provided |
| CAFÉ NAPO | `l-9012` | https://static.wixstatic.com/media/217572_2a604253fe044adf8f929c5804179234~mv2.png (cafenapo.co.il) | official_website |
| קפה בגולף | `l-7906` | https://static.wixstatic.com/media/8cd186_cf997b82062a4e42937320e5fc27caa1~mv2.jpg (cafebagolf.co.il) | official_website |
| Eye Glow | `l-8951` | https://www.eyeglow.co.il/wp-content/uploads/2026/04/69e4da6f66188661e6334a92.jpeg | official_website |
| FOX home | `65` | https://www.foxhome.co.il/cdn/shop/files/foxhomelogo_t_4e2369ef-5350-4de1-98c6-d43a50493a16.webp | official_website |
