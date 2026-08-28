import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Shell } from './components/Shell';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { Accounts } from './screens/Accounts';
import { Activity } from './screens/Activity';
import { TransactionDetail } from './screens/TransactionDetail';
import { Pay } from './screens/Pay';
import { SendAmount } from './screens/SendAmount';
import { RequestMoney } from './screens/RequestMoney';
import { Scan } from './screens/Scan';
import { Cards } from './screens/Cards';
import { CardControls } from './screens/CardControls';
import { Notifications } from './screens/Notifications';
import { Profile } from './screens/Profile';
import { Security } from './screens/Security';
import { Help } from './screens/Help';

export function App() {
  const { user, ready } = useAuth();
  const location = useLocation();

  // Hold the first paint until the refresh cookie has had its chance, so a
  // signed-in visitor never sees the login screen flash past on reload.
  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div
          className="skeleton"
          style={{ width: 46, height: 46, borderRadius: 15 }}
          aria-label="Loading Finto"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace state={{ from: location.pathname }} />}
        />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/activity/:id" element={<TransactionDetail />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/pay/amount" element={<SendAmount />} />
        <Route path="/request" element={<RequestMoney />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/cards/:id/controls" element={<CardControls />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/security" element={<Security />} />
        <Route path="/help" element={<Help />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
