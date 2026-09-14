# Writr 🖋️

> **An intelligent AI writing and manuscript engineering platform.** Designed for writers, researchers, and creators to draft narrative prose, critique stylistic cadence, and index reference corpora with intelligent RAG workflows.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture & Directory Structure](#-architecture--directory-structure)
- [Database & Storage (Supabase)](#-database--storage-supabase)
  - [Profiles Table](#profiles-table)
  - [Auth Trigger Function](#auth-trigger-function)
  - [Storage Buckets & Policies](#storage-buckets--policies)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Available Scripts](#available-scripts)
- [Application Flow & Routes](#-application-flow--routes)
- [Design System & Theming](#-design-system--theming)
- [Security & Performance Best Practices](#-security--performance-best-practices)
- [License](#-license)

---

## 🌟 Overview

**Writr** combines a retro NeoBrutalism-inspired interface with modern web application engineering. Powered by **React 19**, **Supabase**, and **TanStack Query**, it provides seamless user onboarding, secure image/avatar uploads, protected console routes, and dedicated creative workspaces.

---

## ✨ Key Features

### 1. Authentication & User Onboarding
- **Secure Email & Password Flow**: Built on top of Supabase Auth with automated session persistence and refresh.
- **Profile Photo / Avatar Upload**: Custom avatar uploader supporting drag-and-drop, client-side validation (JPEG, PNG, WebP up to 5MB), and direct upload to Supabase Storage.
- **Email Confirmation Ready**: Seamlessly handles environments with or without mandatory email confirmation.
- **Password Reset**: Automated password recovery flow with one-click magic link dispatch.

### 2. Route Protection & Guards
- **`ProtectedRoute`**: Restricts internal features (`/dashboard`, `/generate`, `/critique`, `/ingestion`) to authenticated authors only. Redirects unauthenticated visitors to `/login` while preserving return paths.
- **`PublicOnlyRoute`**: Prevents authenticated users from viewing redundant login/signup pages by redirecting directly to `/dashboard`.

### 3. Dedicated Author Workspaces
- **Author Portal (`/dashboard`)**: Displays real-time author profile information (author name, email, user ID, joined date) alongside platform usage metrics and API telemetry.
- **Narrative Studio (`/generate`)**: Multi-model synthesis environment for crafting chapters, drafting outlines, and tuning voice parameters.
- **Editorial Critique (`/critique`)**: Automated structural prose analysis, pacing/flow metrics, and tone consistency tracking.
- **Knowledge Ingestion (`/ingestion`)**: Document pipeline for indexing reference PDFs, Markdown files, and style corpora for vector search and RAG retrieval.

### 4. NeoBrutalism-Inspired Navigation
- **Arranged for Productivity**: Brand mark and primary workspace tabs on the left; search shortcut, dark mode toggle, and avatar on the right.
- **Quick Command Box**: Displays `Search... [Ctrl K]` for upcoming command palette operations.
- **Avatar Dropdown Menu**: Accessible dropdown menu offering quick links to Account Settings, App Settings, and Session Sign Out.
- **Responsive Navigation**: Automatically converts into a sleek bottom/top mobile strip on smaller viewports.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime & Package Manager** | [Bun](https://bun.sh/) | Blazing-fast JavaScript/TypeScript package manager & runtime |
| **Framework** | [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) | Core UI rendering with instant HMR and modern JSX runtime |
| **Language** | [TypeScript 6](https://www.typescriptlang.org/) | Strict type-safety across schemas, queries, and components |
| **Backend & Auth** | [Supabase](https://supabase.com/) | PostgreSQL, GoTrue Auth, Row-Level Security, and Storage |
| **Data Fetching & Cache** | [TanStack Query v5](https://tanstack.com/query/latest) | Profile fetching, automatic cache invalidation, and deduplication |
| **Routing** | [React Router DOM v7](https://reactrouter.com/) | Declarative client-side routing with route guards |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first CSS with modern `@theme inline` and OKLCH colors |
| **Component Primitives** | [Base UI](https://base-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) | Headless, accessible menu, button, and input primitives |
| **Form Validation** | [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/) | Client-side form management and strict schema validation |
| **Icons & Typography** | [Lucide React](https://lucide.dev/) + [IBM Plex Sans](https://fontsource.org/) | Curated SVG icon library and crisp variable typography |

---

## 📂 Architecture & Directory Structure

```text
write/
├── .agents/                    # Agent skills and documentation references
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Brand graphics and static media
│   ├── components/             # Reusable React components
│   │   ├── ui/                 # Headless shadcn / Base UI primitives
│   │   │   ├── avatar.tsx      # Avatar container & fallback
│   │   │   ├── button.tsx      # Multi-variant button component
│   │   │   ├── dialog.tsx      # Modal dialog primitive
│   │   │   ├── dropdown-menu.tsx # Popover & action dropdown menu
│   │   │   ├── field.tsx       # Form field with label & error slots
│   │   │   ├── input.tsx       # Accessible text input
│   │   │   ├── label.tsx       # Form input labels
│   │   │   └── separator.tsx   # Visual dividers
│   │   ├── app-nav.tsx         # NeoBrutalist navigation header
│   │   ├── avatar-upload.tsx   # Drag-and-drop avatar uploader
│   │   ├── login-form.tsx      # Email/Password login component
│   │   ├── protected-route.tsx # ProtectedRoute and PublicOnlyRoute guards
│   │   ├── signup-form.tsx     # Author signup component with avatar support
│   │   └── theme-provider.tsx  # Light/Dark mode state and keyboard shortcut
│   ├── contexts/               # Global state providers
│   │   └── auth-context.tsx    # Supabase Auth provider & useAuth hook
│   ├── lib/                    # Client libraries and utilities
│   │   ├── query-client.ts     # TanStack Query client configuration
│   │   ├── supabase.ts         # Supabase client export
│   │   └── utils.ts            # Classnames (cn) helper
│   ├── pages/                  # Top-level page views
│   │   ├── CritiquePage.tsx    # Manuscript cadence & tone critique
│   │   ├── DashboardPage.tsx   # Author portal and telemetry dashboard
│   │   ├── ForgotPasswordPage.tsx # Password recovery view
│   │   ├── GeneratePage.tsx    # Narrative drafting studio
│   │   ├── IngestionPage.tsx   # Vector and corpus document pipeline
│   │   ├── LoginPage.tsx       # Standalone login route
│   │   ├── NotFoundPage.tsx    # 404 handler view
│   │   └── SignupPage.tsx      # Standalone registration route
│   ├── types/                  # Shared TypeScript interfaces
│   │   └── auth.ts             # Auth schemas, forms, and UserProfile types
│   ├── App.tsx                 # Root router and query/auth provider tree
│   ├── index.css               # Design tokens, OKLCH Violet theme, and base styles
│   └── main.tsx                # React DOM entry point
├── utils/
│   └── supabase.ts             # Root Supabase fallback client
├── .env                        # Local environment variables (git-ignored)
├── components.json             # shadcn/ui configuration
├── package.json                # Project dependencies and npm scripts
└── tsconfig.json               # TypeScript compiler options
```

---

## 🗄 Database & Storage (Supabase)

The project leverages Supabase PostgreSQL with strict Row-Level Security (RLS) and storage policies.

### Profiles Table

Stores public profile metadata linked directly to `auth.users`:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  author_name text,
  email text,
  avatar_url text,
  updated_at timestamp with time zone default now()
);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile."
  on public.profiles for insert
  to authenticated
  with check (((select auth.uid()) = id));

create policy "Users can update own profile."
  on public.profiles for update
  to authenticated
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));
```

### Auth Trigger Function

Automatically populates `public.profiles` whenever a new user signs up in `auth.users`. Security permissions are explicitly revoked from `PUBLIC`, `anon`, and `authenticated` roles to eliminate PostgREST RPC vulnerabilities:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, author_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'author_name', new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

-- Trigger definition
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Secure execution privileges
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;
```

### Storage Buckets & Policies

Avatars are stored in a dedicated `avatars` bucket with user-scoped folders:

```sql
-- 1. Create public avatars bucket (5MB limit, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Storage RLS Policies
create policy "Public Access for avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Authenticated users can upload avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Authenticated users can update avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Authenticated users can delete avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Bun](https://bun.sh/) (v1.2+ recommended) or [Node.js](https://nodejs.org/) (v20+)
- A [Supabase](https://supabase.com/) project (hosted or local CLI)

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-key>
```

> **Note**: Legacy `VITE_SUPABASE_ANON_KEY` is also supported as a fallback.

### Installation

Install all dependencies using Bun:

```bash
bun install
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts Vite local development server at `http://localhost:5173` |
| `bun run build` | Runs TypeScript check and compiles production build into `dist/` |
| `bun run preview` | Previews the production build locally |
| `bun run typecheck` | Validates TypeScript types across all files without emitting code |
| `bun run lint` | Runs ESLint to check for syntax and style issues |
| `bun run format` | Runs Prettier to auto-format code across TS and TSX files |

---

## 🗺 Application Flow & Routes

```mermaid
graph TD
    A[Visitor Accesses /] --> B{Authenticated?}
    B -->|Yes| C[Redirects to /dashboard]
    B -->|No| D[Redirects to /login]
    
    subgraph Public Routes (PublicOnlyRoute)
        D[LoginPage: /login]
        E[SignupPage: /signup]
        F[ForgotPasswordPage: /forgot-password]
    end

    subgraph Protected Routes (ProtectedRoute)
        C[DashboardPage: /dashboard]
        G[GeneratePage: /generate]
        H[CritiquePage: /critique]
        I[IngestionPage: /ingestion]
    end

    D -->|Authenticates| C
    E -->|Registers| C
    C -->|Top Nav| G
    C -->|Top Nav| H
    C -->|Top Nav| I
    C -->|Dropdown Sign Out| D
```

---

## 🎨 Design System & Theming

Writr utilizes an **OKLCH Violet** design language configured with Tailwind CSS v4 in `src/index.css`:

- **Primary Violet Palette**: `--primary: oklch(0.491 0.27 292.581)` in light mode, `--primary: oklch(0.432 0.232 292.759)` in dark mode.
- **Dynamic Focus Glow**: Interactive inputs and buttons glow with a violet `--ring` highlight on focus.
- **Top Accent Stripe**: NeoBrutalist 2px violet band running across the top viewport.
- **Neutral Fallbacks**: Profile avatars use clean `bg-muted text-muted-foreground` fallbacks to avoid unneeded color noise.
- **Keyboard Shortcut**: Press `d` anywhere in the app to toggle between Dark and Light mode.

---

## 🛡 Security & Performance Best Practices

1. **Subquery RLS Wrapping**: All Postgres RLS policies wrap `(select auth.uid())` in subqueries to prevent per-row function evaluation overhead.
2. **PostgREST RPC Lockdown**: Explicit `REVOKE EXECUTE` ensures security definer functions are non-callable from public REST endpoints.
3. **Optimized React Query Caching**: Profiles are cached with a 5-minute stale time (`staleTime: 1000 * 60 * 5`) and window-focus refetching disabled to eliminate unnecessary network traffic.
4. **Clean Event Teardown**: Supabase `onAuthStateChange` subscription cleanly unsubscribes on unmount to prevent memory leaks.
5. **Form Validation**: Strict client-side schemas using Zod reject oversized files and malformed emails before requests hit the network.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
