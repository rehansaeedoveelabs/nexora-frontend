import { index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.jsx'),
  route('locations', 'routes/locations.jsx'),
  route('routing', 'routes/routing.jsx'),
  route('*', 'routes/not-found.jsx'),
];
