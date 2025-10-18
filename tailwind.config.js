module.exports = {
  purge: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './common/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'accent-1': '#FAFAFA',
        'accent-2': '#EAEAEA',
        'accent-7': '#333',
        success: '#0070f3',
        cyan: '#79FFE1',
        blue: '#416275',
        darkBlue: '#3a5a6b'
      },
      spacing: {
        28: '7rem',
      },
      letterSpacing: {
        tighter: '-.04em',
      },
      lineHeight: {
        tight: 1.2,
      },
      fontSize: {
        '5xl': '2.5rem',
        '6xl': '2.75rem',
        '7xl': '4.5rem',
        '8xl': '6.25rem',
      },
      boxShadow: {
        small: '0 5px 10px rgba(0, 0, 0, 0.12)',
        medium: '0 8px 30px rgba(0, 0, 0, 0.12)',
        dark: 'rgba(0, 0, 0, 0.2) 0px 2px 4px -1px, rgba(0, 0, 0, 0.14) 0px 4px 5px 0px, rgba(0, 0, 0, 0.12) 0px 1px 10px 0px;'
      },
      height: {
        banner: '20rem'
      },
      width: {
        searchBar: '450px'
      },
      typography: {
        'directive': {
          css: {
            'div.youtube-container': {
              display: 'block',
              position: 'relative',
              paddingBottom: `${100*9/16}%`,
              height: '0',
              overflow: 'hidden',
            },
            'iframe.youtube-content': {
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
            }
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
