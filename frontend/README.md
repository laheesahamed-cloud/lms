# Frontend Workspace

This is the new React frontend for the LMS rebuild.

The normal local runtime is:

- Apache/XAMPP serves the root `index.html`, which loads the built app from `frontend/dist`
- NestJS serves the API on `http://localhost:3000/api`

Useful commands:

```bash
npm run build
npm run dev
```

For the main project startup flow, use the root [README.md](/Applications/XAMPP/xamppfiles/htdocs/lms/README.md).
