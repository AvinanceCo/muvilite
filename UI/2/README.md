# Muvi Lite — Cinema UI / UI 2

An independent Persian RTL visual prototype for Muvi Lite. React 19 + Vite, matching the framework used by the main Muvi Lite frontend. Inspired by cinematic browsing patterns and restrained controls from Netflix and Apple TV, with Muvi Lite branding.

## Run

```sh
npm ci
npm run dev
npm run build
```

`dist/` contains the deployable static site. Hash routing supports static hosts without rewrite configuration.

## Included

- Responsive home with a manually controlled three-slide hero, content rails, collections and genre browsing.
- Film and series catalogs, genre filters and rating/year sorting.
- Persian/English title, cast and genre search (including Arabic/Persian letter normalization).
- Title details, related titles and a watchlist persisted locally on the current device.
- Sample MP4 playback with progress persisted locally on the current device.
- Keyboard focus styles, reduced-motion support and focus-trapped search dialog.

## Scope

This is a UI design prototype, **not a live backend integration or production player replacement**. It uses a local sample catalog in `src/data.js`; none of the featured films are streamed. The player clearly identifies its sample as the Sintel trailer, independently of the selected catalog title. Initial continue-watching positions are illustrative sample data.

To integrate into AvinanceCo/muvilite, use as a separate `UI/2` frontend, replace the sample data with `fetchPage`, `fetchMovie`, `searchMovies` and category queries from the existing frontend, map `_id`, `titleFa`, `titleEn`, `backdropPath`, `posterPath`, `descriptionFa`, `publishYear`, `imdbRank`, and restore the existing Muvi Player, watch-session tracking and advertising integration. No changes were pushed to AvinanceCo/muvilite by this design task.

## Assets

Muvi Lite brand and Yekan Bakh font files are reused from the user's public repository. Movie artwork is demonstration material fetched from TMDB; exact original image URLs are in `public/assets/artwork-sources.json`. Film artwork is not covered by the source-code license; confirm rights and replace it with licensed catalog artwork for production.

Sample trailer: Sintel © Blender Foundation, https://durian.blender.org/, CC BY 3.0. Source video: https://media.w3.org/2010/05/sintel/trailer.mp4. Poster: https://media.w3.org/2010/05/sintel/poster.png.

Code is Apache-2.0. Muvi Lite and Avinance brand assets retain their original ownership and trademark terms.
