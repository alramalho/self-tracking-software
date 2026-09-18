# Wrapped map geometry

`world-paths.json` contains the same countries-110m geometry used by the Vite wrapped map, projected once for native SVG rendering (Mercator, scale 140, center [0,20], canvas 800×600). It is bundled so viewing wrapped does not depend on a CDN request.

Source: https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json (world-atlas, ISC; underlying Natural Earth data is public domain). The numeric-to-alpha-2 mapping is copied from `frontend-vite/src/components/wrapped/WorldMapStory.tsx`.

The original Zalando Sans Expanded italic font is bundled in `../fonts/`; its SIL Open Font License is retained alongside it. Source: https://github.com/google/fonts/tree/main/ofl/zalandosansexpanded.

`ZalandoExpanded-BlackItalic.ttf` is a static weight-900 instance of that variable font, generated with fontTools `instantiateVariableFont(font, {"wght": 900})`. Expo's runtime font alias did not select the variable weight correctly on iOS. The static face preserves the PWA's heavy italic titles on native devices.
