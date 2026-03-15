import { createContext, useContext, useState } from 'react';

const ZipContext = createContext(null);

export function ZipProvider({ children }) {
  const [zip, setZip] = useState('');

  return (
    <ZipContext.Provider value={{ zip, setZip }}>
      {children}
    </ZipContext.Provider>
  );
}

export function useZip() {
  return useContext(ZipContext);
}
