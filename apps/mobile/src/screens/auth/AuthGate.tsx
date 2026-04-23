import { useState } from 'react';
import { SignUpScreen } from './SignUpScreen';
import { LoginScreen } from './LoginScreen';

export function AuthGate() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  return mode === 'login' ? (
    <LoginScreen onSwitch={() => setMode('signup')} />
  ) : (
    <SignUpScreen onSwitch={() => setMode('login')} />
  );
}
