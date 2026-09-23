import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    primary: { main: '#2563eb' },
    background: { default: '#f8fafc' }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { disableElevation: true } }
  }
});
