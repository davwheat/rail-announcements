export const pixelValues = {
  desktopSmall: 768,
  desktopLarge: 1100,
  tablet: 640,
  bigPhone: 500,
  phone: 400,
} as const

/** Only used for types! */
const oneBelowPixelValues = {
  desktopSmall: 767,
  desktopLarge: 1099,
  tablet: 639,
  bigPhone: 499,
  phone: 399,
} as const

const mediaUpTo = (px: number) => `@media (max-width: ${px - 1}px)`
const mediaDownTo = (px: number) => `@media (min-width: ${px}px)`
const mediaBetween = (px1: number, px2: number) => {
  const pxLow = Math.min(px1, px2)
  const pxHi = Math.max(px1, px2)

  return `@media (min-width: ${pxLow}px) and (max-width: ${pxHi - 1}px)`
}

type BreakpointNames = keyof typeof pixelValues

/**
 * I am so proud of these types.
 */
interface Breakpoints {
  upTo: {
    [T in BreakpointNames]: `@media (max-width: ${typeof oneBelowPixelValues[T]}px)`
  }
  downTo: {
    [T in BreakpointNames]: `@media (min-width: ${typeof pixelValues[T]}px)`
  }
  between: {
    [T in BreakpointNames]: {
      and: {
        /**
         * If first breakpoint is greater than second, the value shown by your IDE will be wrong,
         * but the output value will be correct.
         */
        [K in Exclude<BreakpointNames, T>]: `@media (min-width: ${typeof pixelValues[T]}px) and (max-width: ${typeof oneBelowPixelValues[K]}px)`
      }
    }
  }
}

const Breakpoints: Breakpoints = {
  upTo: Object.keys(pixelValues).reduce(
    (prev, val) => ({
      ...prev,
      [val]: mediaUpTo(pixelValues[val]),
    }),
    {},
  ),

  downTo: Object.keys(pixelValues).reduce(
    (prev, val) => ({
      ...prev,
      [val]: mediaDownTo(pixelValues[val]),
    }),
    {},
  ),

  between: Object.keys(pixelValues).reduce(
    (prev, val1) => ({
      ...prev,
      [val1]: {
        and: {
          ...Object.keys(pixelValues).reduce(
            (prev2, val2) =>
              val1 !== val2
                ? {
                    ...prev2,
                    [val2]: mediaBetween(pixelValues[val1], pixelValues[val2]),
                  }
                : prev2,
            {},
          ),
        },
      },
    }),
    {},
  ),
} as Breakpoints

export default Breakpoints
