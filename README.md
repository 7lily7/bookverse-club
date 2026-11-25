# BookVerse | 2026 Reading Club

A warm, illustrated, fully English book-sharing website. The 2026 list is already built in: all 24 titles, exactly as provided in the club's annual list.

## Features
- Illustrated, responsive homepage inspired by the supplied reading-room references.
- 24 books across 12 months, with month filters and book-to-library search.
- Shared file library with filename search and direct download.
- Invite-only email magic-link uploads; anonymous visitors may download.
- Formats: PDF, EPUB, DOCX, TXT, MOBI; max 20 MB per file.
- Static frontend suitable for GitHub Pages. **Supabase Storage is required to make uploads/downloads work.**

## 1. Publish on GitHub Pages
1. Sign in to GitHub, click **+ → New repository** and create a **public** repository called `bookverse-club`.
2. Upload the *contents* of this project folder to the repository root (`index.html`, `styles.css`, `app.js`, `config.js`, `assets/`, etc.). If you uploaded `bookverse-club/` as an extra folder, move its contents to the root.
3. Go to **Settings → Pages → Build and deployment** and choose **Deploy from a branch**; select `main` and `/ (root)`; save.
4. Your site will be at `https://YOUR-USERNAME.github.io/bookverse-club/` (unless you use a custom domain).

> The frontend works as a beautiful 2026 book-list demo before file sharing is configured. GitHub Pages alone does **not** store user uploads.

## 2. Set up book sharing with Supabase
1. Create a Supabase project at https://supabase.com/.
2. In your project **SQL Editor**, paste the entire contents of `supabase-setup.sql` and run it. This creates a public downloads bucket, invited-member table, and access policies.
3. In the SQL Editor, insert each permitted uploader, using their real email (all lowercase). Example:
   ```sql
   INSERT INTO public.club_members(email)
   VALUES ('your-email@example.com'), ('friend@example.com')
   ON CONFLICT DO NOTHING;
   ```
4. In Supabase **Project Settings → API / API Keys**, copy the **Project URL** and **publishable/anon key** into `config.js`. Both are intended to be public. **Never paste the service_role / secret key in your website.**
5. In **Authentication → URL Configuration**, set your **Site URL** to your GitHub Pages address and add that URL as an allowed **Redirect URL** (including its trailing slash, e.g. `https://YOUR-USERNAME.github.io/bookverse-club/`).
6. In **Authentication → Providers → Email**, enable email sign-in / magic links. For a small club the default email delivery may be sufficient, but Supabase email quotas may require configuring SMTP for a larger club.
7. Commit the updated `config.js` to your GitHub repository. Hard refresh the deployed website.

## 3. How club members use it
- **Visitors**: browse all 2026 titles and download uploaded books from the Shared Library.
- **Invited members**: click **Share a book** → enter the email you whitelisted → open the email sign-in link → choose a book from the 2026 list → select a permitted file → upload.
- **Club owner**: manage the permitted uploader list by adding/removing emails in `public.club_members` through the Supabase SQL Editor. You may remove inappropriate uploads via Supabase Storage Dashboard.

## Important notes
- This is a **public download** library. Anyone with the link can see and download shared files. Do not upload sensitive documents or material you are not licensed/authorized to distribute. Sharing full commercial ebooks often requires permission from the copyright holder. For such books, share authorized resources or links instead.
- Invited members can upload files; the SQL intentionally does not allow them to modify/delete other files. You, the admin, moderate files through Supabase.
- Passwords, secret API keys, and server-side credentials do not belong in the GitHub Pages repository.
- There is no fake upload: until Supabase is configured, the site explicitly labels the upload/download service as inactive.
- Supabase free-tier limits, storage capacity, and email quotas can change. Check your project's actual quotas.
- The project uses the four reference images provided by the club owner as website artwork, converted to WebP. Ensure you have permission to republish them.

## Project files
- `index.html`: complete responsive page and modal.
- `styles.css`: bookish visual styling and mobile layouts.
- `app.js`: built-in 2026 list, filters, Supabase integration, upload/download logic.
- `config.js`: public Supabase connection settings.
- `supabase-setup.sql`: member permissions and file storage setup.
- `assets/*.webp`: optimized illustrations supplied by the club owner.
