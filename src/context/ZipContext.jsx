import { createContext, useContext, useState } from 'react';

const ZipContext = createContext(null);

export function ZipProvider({ children }) {
  const [zip, setZip] = useState('');
  const [reps, setReps] = useState(null);
  const [userState, setUserState] = useState(null);

  return (
    <ZipContext.Provider value={{ zip, setZip, reps, setReps, userState, setUserState }}>
      {children}
    </ZipContext.Provider>
  );
}

export function useZip() {
  return useContext(ZipContext);
}
