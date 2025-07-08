import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Define global variables for Firebase configuration and app ID
const appId = 'url-shortener-v1'; // Your actual app ID

const firebaseConfig = {
  apiKey: "AIzaSyC93DsmQcx2eIjggt5wVTLXUIy3k-zl5IY",
  authDomain: "url-shortener-b4eec.firebaseapp.com",
  projectId: "url-shortener-b4eec",
  storageBucket: "url-shortener-b4eec.appspot.com",
  messagingSenderId: "982507950230",
  appId: "1:982507950230:web:4f9aa14f6b217683df72b7",
  measurementId: "G-2ECWF9JSPJ"
};

const initialAuthToken = null;

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Utility function to simulate logging (for demonstration/debugging)
const loggly = (message) => {
  console.log(`[Loggly Simulation] ${new Date().toISOString()}: ${message}`);
};

// Main App Component
const App = () => {
  const [page, setPage] = useState('shortener'); // 'shortener' or 'statistics'
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Firebase Authentication Setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        loggly(`User authenticated: ${user.uid}`);
      } else {
        // If no user, try to sign in anonymously if no custom token, or with custom token
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            loggly('Signed in with custom token.');
          } else {
            await signInAnonymously(auth);
            loggly('Signed in anonymously.');
          }
        } catch (authError) {
          console.error("Firebase authentication error:", authError);
          setError(`Authentication failed: ${authError.message}`);
          loggly(`Authentication failed: ${authError.message}`);
        }
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup auth listener
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading application...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Styles defined below for immediate preview */}
      <style>{`
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; word-break: break-word; }
        th { background-color: #f8fafc; font-weight: 600; color: #475569; font-size: 0.875rem; text-transform: uppercase; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .success-message { background-color: #d1fae5; color: #065f46; }
        .error-message { background-color: #fee2e2; color: #991b1b; }
      `}</style>

      <div style={styles.mainContentBox}>
        <h1 style={styles.mainHeading}>
          URL Shortener
        </h1>

        <div style={styles.buttonGroup}>
          <button
            onClick={() => setPage('shortener')}
            style={{
              ...styles.tabButton,
              ...(page === 'shortener' ? styles.tabButtonActive : styles.tabButtonInactive)
            }}
          >
            Shorten URL
          </button>
          <button
            onClick={() => setPage('statistics')}
            style={{
              ...styles.tabButton,
              ...(page === 'statistics' ? styles.tabButtonActive : styles.tabButtonInactive)
            }}
          >
            Statistics
          </button>
        </div>

        {userId && (
          <div style={styles.userIdDisplay}>
            Your User ID: <span style={styles.userIdText}>{userId}</span>
          </div>
        )}

        {page === 'shortener' && <ShortenerPage userId={userId} db={db} isAuthReady={isAuthReady} />}
        {page === 'statistics' && <StatisticsPage userId={userId} db={db} isAuthReady={isAuthReady} />}
      </div>
    </div>
  );
};

// Shortener Page Component
const ShortenerPage = ({ userId, db, isAuthReady }) => {
  const [longUrl, setLongUrl] = useState('');
  const [customShortCode, setCustomShortCode] = useState('');
  const [validity, setValidity] = useState('30'); // Default 30 minutes
  const [shortenedUrl, setShortenedUrl] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [loading, setLoading] = useState(false);

  // Clear messages after a few seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const generateShortCode = async () => {
    let code = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeLength = 6; // Standard short code length

    // Ensure uniqueness
    while (true) {
      for (let i = 0; i < codeLength; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      // Check if code already exists in Firestore
      const docRef = doc(db, `artifacts/${appId}/public/data/shortenedUrls`, code);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return code;
      }
      code = ''; // Reset if exists and try again
    }
  };

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleShorten = async () => {
    if (!isAuthReady) {
      setMessage('Authentication not ready. Please wait.');
      setMessageType('error');
      return;
    }

    if (!longUrl) {
      setMessage('Please enter a long URL.');
      setMessageType('error');
      return;
    }

    if (!validateUrl(longUrl)) {
      setMessage('Please enter a valid URL (e.g., https://example.com).');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');
    setShortenedUrl(null);

    try {
      let finalShortCode = customShortCode.trim();

      if (finalShortCode) {
        // Check if custom short code is unique
        const docRef = doc(db, `artifacts/${appId}/public/data/shortenedUrls`, finalShortCode);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMessage('Custom short code already exists. Please choose another one.');
          setMessageType('error');
          setLoading(false);
          loggly(`Custom short code collision: ${finalShortCode}`);
          return;
        }
      } else {
        finalShortCode = await generateShortCode();
        loggly(`Generated short code: ${finalShortCode}`);
      }

      const expirationTime = validity === 'never'
        ? null // No expiration
        : new Date(Date.now() + parseInt(validity) * 60 * 1000); // Minutes to milliseconds

      const urlData = {
        originalUrl: longUrl,
        shortCode: finalShortCode,
        createdAt: serverTimestamp(),
        expiresAt: expirationTime,
        clicks: 0,
        userId: userId,
        // For geographic data, a real-world app would use IP lookup services.
        // For this demo, we'll just store a placeholder.
        geographicData: {},
      };

      await setDoc(doc(db, `artifacts/${appId}/public/data/shortenedUrls`, finalShortCode), urlData);

      // IMPORTANT: Updated URL format for Cloud Function redirection
      setShortenedUrl(`${window.location.origin}/s?s=${finalShortCode}`);
      setMessage('URL shortened successfully!');
      setMessageType('success');
      setLongUrl('');
      setCustomShortCode('');
      setValidity('30');
      loggly(`URL shortened: ${longUrl} to ${finalShortCode} by user ${userId}`);

    } catch (e) {
      console.error("Error shortening URL:", e);
      setMessage(`Error shortening URL: ${e.message}`);
      setMessageType('error');
      loggly(`Error shortening URL for user ${userId}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setMessage('Copied to clipboard!');
      setMessageType('success');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setMessage('Failed to copy to clipboard.');
      setMessageType('error');
    }
  };

  return (
    <div style={styles.pageContainer}>
      <h2 style={styles.pageHeading}>Shorten Your URL</h2>

      {message && (
        <div
          className={messageType === 'success' ? 'success-message' : 'error-message'}
          style={styles.messageBox}
        >
          {message}
        </div>
      )}

      <div style={styles.formGroup}>
        <label htmlFor="longUrl" style={styles.formLabel}>
          Long URL:
        </label>
        <input
          type="url"
          id="longUrl"
          style={styles.formInput}
          placeholder="e.g., https://verylongexample.com/some/path/to/a/resource"
          value={longUrl}
          onChange={(e) => setLongUrl(e.target.value)}
          required
        />
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="customShortCode" style={styles.formLabel}>
          Custom Short Code (optional):
        </label>
        <input
          type="text"
          id="customShortCode"
          style={styles.formInput}
          placeholder="e.g., my-awesome-link (6-10 alphanumeric characters)"
          value={customShortCode}
          onChange={(e) => setCustomShortCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 10))}
        />
        <p style={styles.hintText}>
          Only alphanumeric characters and hyphens allowed. Max 10 characters.
        </p>
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="validity" style={styles.formLabel}>
          Link Validity:
        </label>
        <select
          id="validity"
          style={styles.formSelect}
          value={validity}
          onChange={(e) => setValidity(e.target.value)}
        >
          <option value="30">30 Minutes (Default)</option>
          <option value="60">1 Hour</option>
          <option value="1440">1 Day</option>
          <option value="10080">7 Days</option>
          <option value="43200">30 Days</option>
          <option value="never">Never Expire</option>
        </select>
      </div>

      <button
        onClick={handleShorten}
        style={{ ...styles.primaryButton, ...(loading ? styles.buttonDisabled : {}) }}
        disabled={loading}
      >
        {loading ? 'Shortening...' : 'Shorten URL'}
      </button>

      {shortenedUrl && (
        <div style={styles.shortenedUrlBox}>
          <h3 style={styles.shortenedUrlHeading}>Your Shortened URL:</h3>
          <div style={styles.shortenedUrlContent}>
            <a
              href={shortenedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.shortenedUrlLink}
            >
              {shortenedUrl}
            </a>
            <button
              onClick={() => copyToClipboard(shortenedUrl)}
              style={styles.copyButton}
            >
              Copy
            </button>
          </div>
          <p style={styles.hintText}>
            Share this link! Clicking it will redirect to your original URL.
          </p>
        </div>
      )}
    </div>
  );
};

// Statistics Page Component
const StatisticsPage = ({ userId, db, isAuthReady }) => {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthReady || !userId) {
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, `artifacts/${appId}/public/data/shortenedUrls`),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUrls = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedUrls.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setUrls(fetchedUrls);
      setLoading(false);
      loggly(`Fetched ${fetchedUrls.length} URLs for user ${userId}`);
    }, (err) => {
      console.error("Error fetching URLs:", err);
      setError(`Failed to load URLs: ${err.message}`);
      setLoading(false);
      loggly(`Error fetching URLs for user ${userId}: ${err.message}`);
    });

    return () => unsubscribe();
  }, [userId, db, isAuthReady]);

  const handleRedirectAndCount = useCallback(async (shortCode, originalUrl) => {
    if (!isAuthReady) {
      console.warn("Auth not ready, cannot increment click count.");
      return;
    }
    try {
      const urlRef = doc(db, `artifacts/${appId}/public/data/shortenedUrls`, shortCode);
      const docSnap = await getDoc(urlRef);

      if (docSnap.exists()) {
        const currentClicks = docSnap.data().clicks || 0;
        await updateDoc(urlRef, {
          clicks: currentClicks + 1,
        });
        loggly(`Click count incremented for ${shortCode}. New count: ${currentClicks + 1}`);
      } else {
        console.warn(`Document for short code ${shortCode} not found.`);
        loggly(`Warning: Document for short code ${shortCode} not found during click increment.`);
      }
      window.open(originalUrl, '_blank');
    } catch (e) {
      console.error("Error incrementing click count or redirecting:", e);
      loggly(`Error incrementing click count for ${shortCode}: ${e.message}`);
    }
  }, [isAuthReady, db]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading your shortened URLs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>Error: {error}</p>
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <div style={styles.noUrlsMessage}>
        <p>You haven't shortened any URLs yet. Go to the "Shorten URL" tab to create one!</p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <h2 style={styles.pageHeading}>Your Shortened URL Statistics</h2>
      <div className="table-container"> {/* Using a class for overflow-x-auto */}
        <table>
          <thead>
            <tr>
              <th>Short URL</th>
              <th>Original URL</th>
              <th>Clicks</th>
              <th>Created At</th>
              <th>Expires At</th>
            </tr>
          </thead>
          <tbody>
            {urls.map((url) => (
              <tr key={url.id}>
                <td style={styles.tableLinkCell}>
                  <button
                    onClick={() => handleRedirectAndCount(url.shortCode, url.originalUrl)}
                    style={styles.tableLinkButton}
                  >
                    {window.location.origin}/s?s={url.shortCode}
                  </button>
                </td>
                <td style={styles.tableDataCell} title={url.originalUrl}>
                  {url.originalUrl}
                </td>
                <td style={styles.tableDataCell}>
                  {url.clicks}
                </td>
                <td style={styles.tableDateCell}>
                  {url.createdAt ? new Date(url.createdAt.toDate()).toLocaleString() : 'N/A'}
                </td>
                <td style={styles.tableDateCell}>
                  {url.expiresAt
                    ? new Date(url.expiresAt.toDate()).toLocaleString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Styles Object ---
const styles = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6', // gray-100
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 16px', // py-8 px-4 sm:px-6 lg:px-8
  },
  mainContentBox: {
    width: '100%',
    maxWidth: '800px', // max-w-4xl (adjusted for better fit on some screens)
    backgroundColor: '#ffffff', // bg-white
    borderRadius: '12px', // rounded-xl
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', // shadow-lg
    padding: '24px 32px', // p-6 sm:p-8
  },
  mainHeading: {
    fontSize: '2.25rem', // text-3xl sm:text-4xl
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937', // gray-800
    marginBottom: '24px', // mb-6
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px', // mb-8
    gap: '16px', // space-x-4
  },
  tabButton: {
    padding: '12px 24px', // px-6 py-3
    borderRadius: '8px', // rounded-lg
    fontWeight: '600', // font-semibold
    fontSize: '1.125rem', // text-lg
    transition: 'all 0.3s ease-in-out', // transition-all duration-300
    border: 'none',
    cursor: 'pointer',
  },
  tabButtonActive: {
    backgroundColor: '#2563eb', // bg-blue-600
    color: '#ffffff', // text-white
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', // shadow-md
  },
  tabButtonInactive: {
    backgroundColor: '#e5e7eb', // bg-gray-200
    color: '#4b5563', // text-gray-700
    // No specific hover style in inline, but you could add :hover in <style>
  },
  userIdDisplay: {
    textAlign: 'center',
    fontSize: '0.875rem', // text-sm
    color: '#4b5563', // gray-600
    marginBottom: '16px', // mb-4
    padding: '8px', // p-2
    backgroundColor: '#eff6ff', // bg-blue-50
    borderRadius: '8px', // rounded-lg
  },
  userIdText: {
    fontFamily: 'monospace',
    color: '#1e40af', // blue-800
    wordBreak: 'break-all',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    fontSize: '1.25rem', // text-xl
    color: '#4b5563', // gray-700
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#fee2e2', // red-100
    color: '#991b1b', // red-800
    padding: '16px',
    borderRadius: '8px',
  },
  errorText: {
    fontSize: '1.25rem', // text-xl
  },
  pageContainer: {
    padding: '16px 24px', // p-4 sm:p-6
    backgroundColor: '#ffffff', // bg-white
    borderRadius: '8px', // rounded-lg
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', // shadow-md
  },
  pageHeading: {
    fontSize: '1.5rem', // text-2xl
    fontWeight: '600', // font-semibold
    color: '#4b5563', // gray-700
    marginBottom: '24px', // mb-6
  },
  messageBox: {
    padding: '12px', // p-3
    marginBottom: '16px', // mb-4
    borderRadius: '8px', // rounded-lg
    textAlign: 'center',
    fontWeight: '500', // font-medium
  },
  formGroup: {
    marginBottom: '16px', // mb-4
  },
  formLabel: {
    display: 'block',
    color: '#4b5563', // gray-700
    fontSize: '0.875rem', // text-sm
    fontWeight: 'bold',
    marginBottom: '8px', // mb-2
  },
  formInput: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', // shadow appearance-none
    border: '1px solid #e2e8f0', // border
    borderRadius: '8px', // rounded-lg
    width: '100%',
    padding: '12px 16px', // py-3 px-4
    color: '#4b5563', // text-gray-700
    lineHeight: '1.25', // leading-tight
    outline: 'none',
    // focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ':focus': {
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)', // focus-ring-2 focus-ring-blue-500
      borderColor: 'transparent',
    }
  },
  formSelect: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    width: '100%',
    padding: '12px 16px',
    color: '#4b5563',
    lineHeight: '1.25',
    outline: 'none',
    marginBottom: '24px', // mb-6
    ':focus': {
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)',
      borderColor: 'transparent',
    }
  },
  hintText: {
    fontSize: '0.75rem', // text-xs
    color: '#6b7280', // gray-500
    marginTop: '4px', // mt-1
  },
  primaryButton: {
    backgroundColor: '#2563eb', // bg-blue-600
    color: '#ffffff', // text-white
    fontWeight: 'bold',
    padding: '12px 24px', // py-3 px-6
    borderRadius: '8px', // rounded-lg
    width: '100%',
    transition: 'all 0.3s ease-in-out', // transition duration-300 ease-in-out transform
    cursor: 'pointer',
    border: 'none',
    // hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    ':hover': {
      backgroundColor: '#1d4ed8', // blue-700
      transform: 'scale(1.02)', // slightly less than 1.05 for inline transition feel
    },
    ':focus': {
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(255,255,255,0.5)', // ring-2 ring-blue-500 ring-offset-2
    }
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  shortenedUrlBox: {
    marginTop: '32px', // mt-8
    padding: '20px', // p-5
    backgroundColor: '#eff6ff', // bg-blue-50
    border: '1px solid #bfdbfe', // border-blue-200
    borderRadius: '8px', // rounded-lg
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)', // shadow-inner
  },
  shortenedUrlHeading: {
    fontSize: '1.25rem', // text-xl
    fontWeight: '600', // font-semibold
    color: '#1e40af', // blue-800
    marginBottom: '12px', // mb-3
  },
  shortenedUrlContent: {
    display: 'flex',
    flexDirection: 'column', // flex-col sm:flex-row
    alignItems: 'center',
    gap: '12px', // space-y-3 sm:space-y-0 sm:space-x-4
    '@media (min-width: 640px)': { // sm: breakpoint
      flexDirection: 'row',
      gap: '16px',
    }
  },
  shortenedUrlLink: {
    flexGrow: 1,
    color: '#2563eb', // blue-600
    textDecoration: 'underline',
    fontSize: '1.125rem', // text-lg
    fontWeight: '500', // font-medium
    wordBreak: 'break-all',
    // hover:text-blue-800
    ':hover': {
      color: '#1e40af', // blue-800
    }
  },
  copyButton: {
    backgroundColor: '#10b981', // bg-green-500
    color: '#ffffff', // text-white
    fontWeight: 'bold',
    padding: '8px 16px', // py-2 px-4
    borderRadius: '8px', // rounded-lg
    flexShrink: 0,
    transition: 'all 0.3s ease-in-out', // transition duration-300 ease-in-out
    cursor: 'pointer',
    border: 'none',
    // hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
    ':hover': {
      backgroundColor: '#059669', // green-600
    },
    ':focus': {
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.5), 0 0 0 6px rgba(255,255,255,0.5)', // ring-2 ring-green-500 ring-offset-2
    }
  },
  noUrlsMessage: {
    padding: '24px', // p-6
    textAlign: 'center',
    color: '#4b5563', // gray-600
  },
  tableLinkCell: {
    fontSize: '0.875rem', // text-sm
    fontWeight: '500', // font-medium
    color: '#2563eb', // blue-600
  },
  tableLinkButton: {
    textDecoration: 'none',
    color: 'inherit',
    background: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    // hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-0 py-0 w-auto
    ':hover': {
      textDecoration: 'underline',
    },
    ':focus': {
      outline: 'none',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(255,255,255,0.5)', // ring-2 ring-blue-500 ring-offset-2
      borderRadius: '4px',
    },
  },
  tableDataCell: {
    fontSize: '0.875rem', // text-sm
    color: '#1f2937', // gray-800
    maxWidth: '200px', // max-w-xs (approx)
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableDateCell: {
    fontSize: '0.875rem', // text-sm
    color: '#6b7280', // gray-500
  }
};

export default App;