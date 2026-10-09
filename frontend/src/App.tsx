import { BrowserRouter } from 'react-router-dom'
import { AuthProvider }  from './context/AuthContext'
import { WalletProvider } from './context/WalletContext'
import AppRoutes         from './routes/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <AppRoutes />
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
