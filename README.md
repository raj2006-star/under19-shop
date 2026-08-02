# UNDER19 COLLXN — Deployment Guide

This folder has two parts:

- `backend/` — the server that stores your products, handles logins, and talks to Razorpay to actually take payments. This is where your secret keys live.
- `frontend/` — the actual website (`index.html`) that buyers see and use.

Follow these steps in order. None of them need coding knowledge.

## Step 1 — Create a Razorpay account (this is how you get paid)

1. Go to https://razorpay.com and sign up as a business.
2. Complete their KYC (you'll need PAN, bank account details, and basic business info — for an individual/proprietorship this is usually quick).
3. Once approved, go to **Settings → API Keys** in your Razorpay dashboard and generate a **Key ID** and **Key Secret**.
4. Keep these two values private — never share the Key Secret with anyone or paste it into the frontend website.
5. Razorpay gives you **test keys** first — use these to try everything out safely before going live. Switch to live keys only once you've tested a full purchase.

## Step 2 — Deploy the backend (this is what holds your secret keys safely)

1. Create a free account at https://render.com
2. Put the `backend` folder into its own GitHub repository (create a free GitHub account at https://github.com if you don't have one, create a new repository, and upload the contents of the `backend` folder).
3. In Render, click **New → Web Service**, connect your GitHub repo.
4. Set:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. Under **Environment**, add these variables:
   - `RAZORPAY_KEY_ID` = your key ID from Step 1
   - `RAZORPAY_KEY_SECRET` = your key secret from Step 1
6. Click **Deploy**. Once it's live, Render gives you a URL like `https://under19-backend.onrender.com` — copy this, you'll need it next.

## Step 3 — Connect the frontend to your backend

1. Open `frontend/index.html` in any text editor.
2. Find this line near the top of the `<script>` section:
   ```
   const API_BASE = "https://YOUR-BACKEND-URL-HERE";
   ```
3. Replace `https://YOUR-BACKEND-URL-HERE` with the Render URL from Step 2, e.g.:
   ```
   const API_BASE = "https://under19-backend.onrender.com";
   ```
4. Save the file.

## Step 4 — Publish the website

1. Go to https://app.netlify.com/drop
2. Drag and drop the `frontend` folder (or just `index.html`) onto the page.
3. Netlify instantly gives you a live link, e.g. `under19collxn.netlify.app`. Your site is now online.

## Step 5 — Test it before going live

1. While still using your Razorpay **test keys**, place a test order on your live site using Razorpay's test card numbers (listed in their docs under "Test Card Details").
2. Check the Admin panel (the "admin" link in your site's footer, default password `under19` — change this immediately from Admin → Settings) to confirm the order shows up.
3. Once everything works, go back to Render, replace your test keys with your **live** Razorpay keys, and redeploy. Now real payments will land in your real bank account.

## Step 6 — (Optional) Buy a domain

Buy a domain from Hostinger, Namecheap, or GoDaddy (roughly ₹100–800/year), then in Netlify go to **Domain Settings → Add custom domain** and follow their instructions to point it at your site.

## A few important notes

- Never share your Razorpay **Key Secret** with anyone, and never put it inside `index.html` — it only belongs in the backend's environment variables.
- The free Render plan may "sleep" your backend after periods of no traffic, causing the first request after a while to take a few extra seconds to wake up. This is normal on the free tier; paid plans avoid it.
- Product photos and order data are stored in a file on the backend server. On Render's free tier this file can reset if the service restarts — for a growing shop, consider upgrading to a paid Render plan or moving to a proper database later.
