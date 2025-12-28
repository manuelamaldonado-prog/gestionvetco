import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';

import Dashboard from './components/Dashboard';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import PracticeCatalog from './components/PracticeCatalog';
import Reports from './components/Reports';
import MonthlyStatement from './components/MonthlyStatement';
import CustomStatement from './components/CustomStatement';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/statement/:clientId/:month" element={<MonthlyStatement />} />
            <Route path="/reports/custom-statement/:clientId/:fromDate/:toDate" element={<CustomStatement />} />
            <Route path="/catalog" element={<PracticeCatalog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
