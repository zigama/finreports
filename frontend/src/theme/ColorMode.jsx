import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../theme';

const ColorModeCtx = createContext({ mode:'light', toggle: ()=>{} });
export const useColorMode = () => useContext(ColorModeCtx);

export default function ColorModeProvider({ children }){
  const [mode, setMode] = useState(() => localStorage.getItem('frp_mode') || 'light');

  useEffect(() => { localStorage.setItem('frp_mode', mode); }, [mode]);
  const value = useMemo(() => ({ mode, toggle: () => setMode(m => m === 'light' ? 'dark' : 'light') }), [mode]);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ColorModeCtx.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ColorModeCtx.Provider>
  );
}
