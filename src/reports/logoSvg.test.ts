import { describe, expect, it } from 'vitest';
import { inlineSvgClassFills } from './pdf';

describe('inlineSvgClassFills', () => {
  it('moves CSS class fills onto elements for the PDF renderer, with either quote style', () => {
    const src = `<svg><defs><style>.cls-1 { fill: #de1c28; }</style></defs><path class="cls-1" d="M0"/><path class='cls-1' d="M1"/><path class="other" d="M2"/></svg>`;
    const out = inlineSvgClassFills(src);
    expect(out).not.toContain('<style');
    expect(out.match(/fill="#de1c28"/g)).toHaveLength(2);
    expect(out).toContain('class="other"');
  });
});
