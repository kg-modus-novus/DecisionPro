import { KY_COUNTY_SHAPES } from '../data/alp/kyCountyShapes.js';
import { bandIndexFor } from '../lib/simpleMode/simpleModeData.js';

export const BAND_COLORS = ['#1d3d5c', '#24597f', '#2f78a3', '#4a9cc7', '#8fdcff'];

export function KyCountyHeatMap({ rows, bands, selectedFips, onSelectCounty }) {
  const rowsByFips = new Map(rows.map((row) => [row.fips, row]));
  return (
    <figure className="sm-map">
      <svg
        viewBox={KY_COUNTY_SHAPES.viewBox}
        role="group"
        aria-label="Kentucky counties shaded by Medicaid members"
        className="sm-map-svg"
      >
        {KY_COUNTY_SHAPES.counties.map((shape) => {
          const row = rowsByFips.get(shape.fips);
          const band = bandIndexFor(row?.members, bands);
          const selected = shape.fips === selectedFips;
          const label = row
            ? `${row.name} County: ${row.membersDisplay} Medicaid members`
            : `${shape.name} County: not reported`;
          return (
            <path
              key={shape.fips}
              d={shape.d}
              data-fips={shape.fips}
              className={`sm-map-county${selected ? ' is-selected' : ''}`}
              fill={band == null ? '#3a4656' : BAND_COLORS[band]}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onSelectCounty?.(selected ? null : shape.fips)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectCounty?.(selected ? null : shape.fips);
                }
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <figcaption className="sm-map-legend" aria-label="Map legend">
        <span>Medicaid members</span>
        <ol>
          {bands.map((band) => (
            <li key={band.index}>
              <i style={{ background: BAND_COLORS[band.index] }} aria-hidden="true" />
              {band.min.toLocaleString('en-US')}–{band.max.toLocaleString('en-US')}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
