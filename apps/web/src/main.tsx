// First import, so a bad env fails before anything renders.
import '@/lib/env';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/app';
import { createAppRouter } from '@/app/router';
import { createQueryClient } from '@/systems/api/query-client';
import '@/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

const queryClient = createQueryClient();
const router = createAppRouter();

createRoot(root).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} />
  </StrictMode>,
);
