// @material/material-color-utilities 0.3.0 の SchemeTonalSpot で生成した値（Figma の Scheme コレクションと同じ）。
// seed: low=#2F9E8F, medium=#D49A1E, high=#B0306A

export interface ColorScheme {
  readonly primary: string;
  readonly onPrimary: string;
  readonly primaryContainer: string;
  readonly onPrimaryContainer: string;
  readonly secondary: string;
  readonly onSecondary: string;
  readonly secondaryContainer: string;
  readonly onSecondaryContainer: string;
  readonly tertiary: string;
  readonly onTertiary: string;
  readonly tertiaryContainer: string;
  readonly onTertiaryContainer: string;
  readonly error: string;
  readonly onError: string;
  readonly errorContainer: string;
  readonly onErrorContainer: string;
  readonly surface: string;
  readonly onSurface: string;
  readonly onSurfaceVariant: string;
  readonly surfaceContainerLowest: string;
  readonly surfaceContainerLow: string;
  readonly surfaceContainer: string;
  readonly surfaceContainerHigh: string;
  readonly surfaceContainerHighest: string;
  readonly surfaceDim: string;
  readonly surfaceBright: string;
  readonly inverseSurface: string;
  readonly inverseOnSurface: string;
  readonly inversePrimary: string;
  readonly outline: string;
  readonly outlineVariant: string;
  readonly scrim: string;
}

export const schemes = {
  'low-light': {
    primary: '#006b5f',
    onPrimary: '#ffffff',
    primaryContainer: '#9ef2e3',
    onPrimaryContainer: '#005047',
    secondary: '#4a635e',
    onSecondary: '#ffffff',
    secondaryContainer: '#cce8e2',
    onSecondaryContainer: '#334b47',
    tertiary: '#456179',
    onTertiary: '#ffffff',
    tertiaryContainer: '#cbe6ff',
    onTertiaryContainer: '#2d4a60',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
    surface: '#f4fbf8',
    onSurface: '#171d1b',
    onSurfaceVariant: '#3f4946',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#eff5f2',
    surfaceContainer: '#e9efec',
    surfaceContainerHigh: '#e3eae7',
    surfaceContainerHighest: '#dde4e1',
    surfaceDim: '#d5dbd9',
    surfaceBright: '#f4fbf8',
    inverseSurface: '#2b3230',
    inverseOnSurface: '#ecf2ef',
    inversePrimary: '#82d5c7',
    outline: '#6f7976',
    outlineVariant: '#bec9c5',
    scrim: '#000000',
  },
  'medium-light': {
    primary: '#7b580d',
    onPrimary: '#ffffff',
    primaryContainer: '#ffdea9',
    onPrimaryContainer: '#5f4100',
    secondary: '#6d5c3f',
    onSecondary: '#ffffff',
    secondaryContainer: '#f7dfbb',
    onSecondaryContainer: '#54442a',
    tertiary: '#4d6543',
    onTertiary: '#ffffff',
    tertiaryContainer: '#cfebc0',
    onTertiaryContainer: '#364d2d',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
    surface: '#fff8f3',
    onSurface: '#201b13',
    onSurfaceVariant: '#4e4639',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#fdf2e5',
    surfaceContainer: '#f8ecdf',
    surfaceContainerHigh: '#f2e6d9',
    surfaceContainerHighest: '#ece1d4',
    surfaceDim: '#e3d8cc',
    surfaceBright: '#fff8f3',
    inverseSurface: '#353027',
    inverseOnSurface: '#faefe2',
    inversePrimary: '#eebf6d',
    outline: '#807667',
    outlineVariant: '#d2c5b4',
    scrim: '#000000',
  },
  'high-light': {
    primary: '#8b4a62',
    onPrimary: '#ffffff',
    primaryContainer: '#ffd9e3',
    onPrimaryContainer: '#6f334a',
    secondary: '#74565f',
    onSecondary: '#ffffff',
    secondaryContainer: '#ffd9e3',
    onSecondaryContainer: '#5a3f48',
    tertiary: '#7d5636',
    onTertiary: '#ffffff',
    tertiaryContainer: '#ffdcc3',
    onTertiaryContainer: '#623f20',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
    surface: '#fff8f8',
    onSurface: '#22191c',
    onSurfaceVariant: '#514347',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#fff0f3',
    surfaceContainer: '#faeaed',
    surfaceContainerHigh: '#f4e4e7',
    surfaceContainerHighest: '#efdfe2',
    surfaceDim: '#e6d6d9',
    surfaceBright: '#fff8f8',
    inverseSurface: '#372e30',
    inverseOnSurface: '#fdedf0',
    inversePrimary: '#ffb0ca',
    outline: '#837377',
    outlineVariant: '#d5c2c6',
    scrim: '#000000',
  },
} as const satisfies Record<string, ColorScheme>;
