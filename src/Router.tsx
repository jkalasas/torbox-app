import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DownloadsPage } from './pages/Downloads.page';

const router = createBrowserRouter([
  {
    path: '/',
    element: <DownloadsPage />,
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
