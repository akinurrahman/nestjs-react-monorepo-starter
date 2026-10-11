import { pageWindow } from './page-window';

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('lists nothing when there are no pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it('puts a gap on both sides of a page in the middle', () => {
    expect(pageWindow(10, 63)).toEqual([1, 'gap', 9, 10, 11, 'gap', 63]);
  });

  it('always shows the first and last page', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('leaves no gap where the neighbours touch the ends', () => {
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
    expect(pageWindow(18, 20)).toEqual([1, 'gap', 17, 18, 19, 20]);
  });
});
