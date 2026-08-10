import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader'
import { ActorProvider } from './context/ActorContext'
import { EngineerDashboardPage } from './pages/EngineerDashboardPage'
import { ImportInitiativePage } from './pages/ImportInitiativePage'
import { KbiCatalogPage } from './pages/KbiCatalogPage'
import { KbiDetailPage } from './pages/KbiDetailPage'
import { MarketplacePage } from './pages/MarketplacePage'
import { MonthlyReportPage } from './pages/MonthlyReportPage'
import { PlatformInitiativeCatalogPage } from './pages/PlatformInitiativeCatalogPage'
import { PlatformInitiativeDetailPage } from './pages/PlatformInitiativeDetailPage'
import { RecurringOpsCatalogPage } from './pages/RecurringOpsCatalogPage'
import { RecurringOpsDetailPage } from './pages/RecurringOpsDetailPage'
import { TeamSummaryPage } from './pages/TeamSummaryPage'
import { WeeklyTimeEntryPage } from './pages/WeeklyTimeEntryPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ActorProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppHeader />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<EngineerDashboardPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/team" element={<TeamSummaryPage />} />
              <Route path="/reports/monthly" element={<MonthlyReportPage />} />
              <Route path="/kbis" element={<KbiCatalogPage />} />
              <Route path="/kbis/:id" element={<KbiDetailPage />} />
              <Route path="/platform-initiatives" element={<PlatformInitiativeCatalogPage />} />
              <Route path="/platform-initiatives/:id" element={<PlatformInitiativeDetailPage />} />
              <Route path="/recurring-ops" element={<RecurringOpsCatalogPage />} />
              <Route path="/recurring-ops/:id" element={<RecurringOpsDetailPage />} />
              <Route path="/log-time" element={<WeeklyTimeEntryPage />} />
              <Route path="/import" element={<ImportInitiativePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
      </ActorProvider>
    </QueryClientProvider>
  )
}

export default App
