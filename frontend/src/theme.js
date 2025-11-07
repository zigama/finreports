import { createTheme } from '@mui/material/styles';

export const createAppTheme = (mode = 'light') =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#1a73e8' },
      secondary: { main: '#0b8043' },
      background: { default: mode === 'light' ? '#f7f9fb' : '#0e1116' }
    },
    shape: { borderRadius: 18 },
    typography: {
      fontFamily: 'Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial',
      h5: { fontWeight: 800 },
      h6: { fontWeight: 800 }
    },
    components: {
      MuiPaper: { styleOverrides: { root: { borderRadius: 24 } } },
      MuiButton: {
        defaultProps: { size: 'large' },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderRadius: 16, paddingTop: 12, paddingBottom: 12 }
        }
      },
      MuiTextField: { defaultProps: { variant: 'outlined', size: 'medium' } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 14 } } }
    }
  });
