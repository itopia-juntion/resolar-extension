// background.js

// Helper function to get data from local storage
const getStorageData = (keys) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result);
    });
  });

// Helper function to set data in local storage
const setStorageData = (items) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });

const API_BASE_URL = 'https://c614105eedfe.ngrok-free.app/api';

// Function to perform login and store credentials
async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '로그인에 실패했습니다.' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.accessToken) {
      await setStorageData({
        accessToken: data.accessToken,
        username: username, // Store for re-login
        password: password, // Store for re-login (Note: this is not ideal for security)
      });
      return { success: true };
    } else {
      throw new Error('응답에 accessToken이 없습니다.');
    }
  } catch (error) {
    console.error('Login failed:', error);
    return { success: false, error: error.message };
  }
}

// Generic fetch function with automatic re-login
async function fetchWithAuth(url, options = {}, isRetry = false) {
  const { accessToken } = await getStorageData(['accessToken']);

  if (!accessToken) {
    return { success: false, error: 'No access token found. Please log in.', shouldRelogin: true };
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };

  const response = await fetch(url, { ...options, headers });

  // If token is expired (401 Unauthorized) and it's the first attempt
  if (response.status === 401 && !isRetry) {
    console.log('Access token expired. Attempting to re-login...');
    const { username, password } = await getStorageData(['username', 'password']);

    if (!username || !password) {
        return { success: false, error: '자동 재로그인을 위한 정보가 없습니다.', shouldRelogin: true };
    }

    const loginResult = await login(username, password);
    if (loginResult.success) {
      console.log('Re-login successful. Retrying original request...');
      return fetchWithAuth(url, options, true);
    } else {
      console.error('Automatic re-login failed.');
      await chrome.storage.local.remove(['accessToken', 'username', 'password']);
      return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.', shouldRelogin: true };
    }
  }

  return response;
}


// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let keepChannelOpen = true; // Keep message channel open for async response

  if (request.action === 'login') {
    const { username, password } = request.data;
    login(username, password).then(sendResponse);
  } else if (request.action === 'submitData') {
    const endpoint = `${API_BASE_URL}/pages`;
    
    fetchWithAuth(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.data),
    })
    .then(async response => {
        if (response.ok) {
            return { success: true, data: await response.json() };
        }
        if (response.shouldRelogin) {
            return { success: false, error: response.error, shouldRelogin: true };
        }
        const errorData = await response.json().catch(() => ({ message: '알 수 없는 서버 오류' }));
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
    })
    .then(sendResponse)
    .catch(error => {
        console.error("Error submitting data:", error);
        sendResponse({ success: false, error: error.message });
    });
  } else if (request.action === 'getSubjects') {
    const endpoint = `${API_BASE_URL}/subjects`;
    fetchWithAuth(endpoint, { method: 'GET' })
    .then(async response => {
        if (response.ok) {
            return { success: true, data: await response.json() };
        }
        if (response.shouldRelogin) {
            return { success: false, error: response.error, shouldRelogin: true };
        }
        const errorData = await response.json().catch(() => ({ message: '주제 목록을 불러올 수 없습니다.' }));
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
    })
    .then(sendResponse)
    .catch(error => {
        console.error("Error fetching subjects:", error);
        sendResponse({ success: false, error: error.message });
    });
  }
  else {
      keepChannelOpen = false; // No async action, close channel
  }

  return keepChannelOpen;
});

console.log("Resolar background script loaded.");