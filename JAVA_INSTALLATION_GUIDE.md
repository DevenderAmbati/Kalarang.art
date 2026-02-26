# Java Installation Guide for Firebase Emulators

## Error: Could not spawn `java -version`

Firebase emulators require Java Runtime Environment (JRE) or Java Development Kit (JDK) to run.

## Quick Installation Steps

### Step 1: Download Java

**Recommended: OpenJDK 11 or 17**

Choose one option:

**Option A: Microsoft OpenJDK (Easiest for Windows)**

1. Go to: https://learn.microsoft.com/en-us/java/openjdk/download
2. Download "Microsoft Build of OpenJDK 17" for Windows x64
3. Run the installer (.msi file)
4. ✅ Installer automatically adds Java to PATH

**Option B: Oracle Java**

1. Go to: https://www.oracle.com/java/technologies/downloads/
2. Download Java SE Development Kit (JDK 17 or 21)
3. Run the installer
4. During installation, check "Add to PATH" option

**Option C: Amazon Corretto**

1. Go to: https://aws.amazon.com/corretto/
2. Download Corretto 17 for Windows
3. Run the installer
4. Installer adds to PATH automatically

### Step 2: Verify Installation

Open a **new PowerShell window** and run:

```powershell
java -version
```

Expected output:

```
openjdk version "17.0.x" 2024-xx-xx
OpenJDK Runtime Environment (build 17.0.x+x)
OpenJDK 64-Bit Server VM (build 17.0.x+x, mixed mode, sharing)
```

### Step 3: Start Firebase Emulators

```bash
cd "C:\Users\ASUS\Desktop\Kalarang MVP\kalarang"
firebase emulators:start
```

## Manual PATH Configuration (If Java Still Not Found)

If `java -version` doesn't work after installation:

### 1. Find Java Installation Path

Common locations:

- `C:\Program Files\Microsoft\jdk-17.x.x`
- `C:\Program Files\Java\jdk-17.x.x`
- `C:\Program Files\Eclipse Adoptium\jdk-17.x.x`

### 2. Add to System PATH

1. Press `Windows + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables" button
3. Under "System variables", find "Path", click "Edit"
4. Click "New" and add: `C:\Program Files\Microsoft\jdk-17.x.x\bin`
5. Click "OK" on all dialogs
6. **Important**: Close and reopen PowerShell

### 3. Verify Again

```powershell
java -version
```

## Alternative: Test Without Emulators

If you don't want to install Java right now, you can:

### Deploy to Production and Test There

```bash
# Set production secret
firebase functions:secrets:set GMAIL_APP_PASSWORD

# Deploy function
firebase deploy --only functions:sendSupportEmail

# Test in your production app
npm start
# Go to Profile → Send test message
```

### Use Firebase Console to Test

1. Deploy function: `firebase deploy --only functions:sendSupportEmail`
2. Go to [Firebase Console](https://console.firebase.google.com/)
3. Navigate to Functions → sendSupportEmail
4. Click "Test function" to invoke manually
5. Provide test data:
   ```json
   {
     "message": "Test message",
     "userName": "Test User",
     "userEmail": "test@example.com"
   }
   ```

## Troubleshooting

### Issue: "Java not found" after installation

**Solution**: Close and reopen PowerShell (or restart computer)

### Issue: Multiple Java versions installed

**Solution**: Check which version is active:

```powershell
where.exe java
```

This shows all Java installations. The first one listed is used.

### Issue: Permission denied during installation

**Solution**: Right-click installer → "Run as Administrator"

## Recommended: Microsoft OpenJDK

For Windows users, we recommend Microsoft's OpenJDK because:

- ✅ Official Microsoft support
- ✅ Automatic PATH configuration
- ✅ No Oracle account required
- ✅ Free and open source
- ✅ Regular security updates

Download: https://learn.microsoft.com/en-us/java/openjdk/download

## Quick Install Command (via Winget)

If you have Windows Package Manager (winget):

```powershell
winget install Microsoft.OpenJDK.17
```

Then restart PowerShell and verify:

```powershell
java -version
```

---

**After Java is installed, you can run:**

```bash
firebase emulators:start
```

This will start:

- Functions Emulator
- Firestore Emulator (if configured)
- Auth Emulator (if configured)
- Storage Emulator (if configured)

Then test your email function locally! 🎉
