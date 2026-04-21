# Google Form → Student in Firebase

This guide shows how to create a Google Form so that when someone submits it, a **student** is automatically created in your Firebase (Firestore). You can then see and edit the student in your tuition management frontend.

## Overview

1. **Backend** exposes a public endpoint: `POST /api/public/student-from-form`, protected by a secret.
2. **Google Form** collects student details (name, school, level, parent info).
3. **Google Apps Script** runs on form submit and sends the response to your backend with the secret.
4. **Frontend** shows the new student under Students; you can edit as needed.

---

## Step 1: Backend – set the form secret

1. In `backend/.env`, add a long random string (e.g. generate with `openssl rand -hex 32`):

   ```env
   FORM_SUBMIT_SECRET=your-long-random-secret-string
   ```

2. Restart your backend. The endpoint `POST /api/public/student-from-form` will only accept requests that send this secret in the `X-Form-Secret` header (or `secret` query param).

3. **Backend URL** you’ll need later:
   - Local: `http://localhost:4000` (or your `PORT`)
   - Production: `https://your-deployed-backend.com` (no trailing slash)

---

## Step 2: Create the Google Form

1. Go to [Google Forms](https://forms.google.com) and create a new form.
2. Add questions that map to the student fields. **Question titles** in the form will be used in the script; you can match the names below or adjust the script.

Suggested questions (order and titles can vary; the script maps by **item title**):

| Form question title   | Student field     | Type        |
|-----------------------|-------------------|-------------|
| Student Name          | name              | Short answer|
| School                | school            | Short answer|
| Level                 | level             | Short answer (e.g. Sec 3, Primary 5) |
| Parent Name           | parent_name       | Short answer|
| Parent Contact        | parent_contact    | Short answer|
| Parent Email          | parent_email     | Short answer|

- Make “Student Name”, “Parent Name”, and “Parent Contact” **required** if you want.
- You can add a “Status” dropdown (Active / Inactive) and map it in the script; otherwise new students are created as **active**.

3. **Responses**: either leave “Save responses to Google Sheets” on (recommended so you have a copy), or turn it off. The script will still send data to your backend.

4. Copy the **form URL** (e.g. `https://docs.google.com/forms/d/e/xxxxx/viewform`). You’ll share this with parents/students to register.

---

## Step 3: Add Apps Script to the form

1. In the form, open **Extensions → Apps Script**.
2. Delete any default code and paste the script below.
3. **Edit the two constants** at the top:
   - `BACKEND_BASE_URL`: your backend URL (e.g. `https://your-backend.com` or `http://localhost:4000` for testing).
   - `FORM_SECRET`: the same value as `FORM_SUBMIT_SECRET` in your `backend/.env`.
4. Save (Ctrl+S / Cmd+S) and name the project (e.g. “Student Form to Firebase”).

```javascript
// ============== CONFIG – edit these ==============
// MUST include https:// (e.g. https://your-app.up.railway.app)
var BACKEND_BASE_URL = 'https://your-backend.com';
var FORM_SECRET      = 'your-long-random-secret-string';  // same as FORM_SUBMIT_SECRET in backend
// ================================================

function onSubmit(e) {
  if (!e || !e.response) return;
  var response = e.response;
  var byTitle = {};
  response.getItemResponses().forEach(function (r) {
    byTitle[r.getItem().getTitle().trim()] = r.getResponse();
  });

  var payload = {
    name:            byTitle['Student Name'] || byTitle['Student name'] || '',
    school:          byTitle['School'] || byTitle['school'] || '',
    level:           byTitle['Level'] || byTitle['level'] || '',
    parent_name:     byTitle['Parent Name'] || byTitle['Parent name'] || '',
    parent_contact:  byTitle['Parent Contact'] || byTitle['Parent contact'] || '',
    parent_email:    byTitle['Parent Email'] || byTitle['Parent email'] || '',
    status:          byTitle['Status'] || 'active'
  };

  var url = BACKEND_BASE_URL.replace(/\/$/, '') + '/api/public/student-from-form';
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { 'X-Form-Secret': FORM_SECRET },
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText();

  if (code >= 200 && code < 300) {
    Logger.log('Student created: ' + body);
  } else {
    Logger.log('Error ' + code + ': ' + body);
  }
}
```

5. **Install the trigger** so the script runs on every form submit:
   - In the Apps Script editor, click the **clock icon** (Triggers).
   - **Add Trigger**: function `onSubmit`, event type **On form submit** (From form).
   - Save and authorize the script when Google asks (choose your account and allow access).

---

## Step 4: Test and use

1. Submit a test response in the form.
2. In Apps Script, open **Executions** (left sidebar) to see if `onSubmit` ran and whether it logged success or an error.
3. In your **tuition management frontend**, open **Students**. The new student should appear; you can edit details or enrol them in classes as usual.

---

## Troubleshooting

- **401 Invalid or missing form secret**  
  - `FORM_SUBMIT_SECRET` in `.env` and `FORM_SECRET` in the script must match exactly (no extra spaces).

- **503 Form submission not configured**  
  - Add `FORM_SUBMIT_SECRET=...` to `backend/.env` and restart the backend.

- **Backend not reachable from Google**  
  - Apps Script runs on Google’s servers. For localhost you can test with a tool like ngrok; for production use your real backend URL.

- **Wrong or empty fields in Firebase**  
  - Check that your form question **titles** match the keys used in the script (e.g. `'Student Name'`, `'Parent Contact'`). Adjust the `byTitle['...']` lines in the script to match your form.

---

## Optional: different question titles

If your form uses different labels (e.g. “Child’s name” instead of “Student Name”), change only the script mapping, for example:

```javascript
name: byTitle["Child's name"] || byTitle['Student Name'] || '',
```

Keep the **payload** keys (`name`, `school`, `level`, `parent_name`, `parent_contact`, `parent_email`, `status`) as they are; those are what the backend expects.
