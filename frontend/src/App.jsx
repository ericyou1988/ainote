import { HashRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<NotesPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:id" element={<NotesPage />} />
          <Route path="notes/:id/analysis" element={<NotesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
