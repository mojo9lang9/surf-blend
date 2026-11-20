# Northeast Surf Blend

Joe's NH–RI surf forecast at https://mojo9lang9.github.io/surf-blend/

The site has these parts:
- **Buoys** along the top: Jeffreys Ledge, Portland, Boston, Block Island (NDBC).
- **Selected break** with today's ring, an hour-by-hour strip of surf, wind and tide, and a side-by-side of the three sources.
- **Live cam**: YouTube streams near the break, from surf-forecast.com's cam list, play in the page. Other cam sites block embedding, so those get a link.
- **Every break, best first**: sorted by conditions, then drive time, with five-day rings under each description.

How heights are blended: Surf Captain 50%, Surfline 25%, surf-forecast.com 25%, reweighted when a source is missing. Colors come from Surf Captain's clean / fair / choppy call, stepped up one level where a headland or a second face shelters the spot from the wind.

`data/*.json` is rewritten every morning by the "Surf Blend Refresh" scheduled task. `calc.js` does the scoring and `app.js` draws the page.
