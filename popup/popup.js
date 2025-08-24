document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginContainer = document.getElementById('login-container');
  const mainAppContainer = document.getElementById('main-app');
  const loginButton = document.getElementById('login-button');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');

  // Main App UI Elements
  const urlSpan = document.getElementById('url');
  const statusDiv = document.getElementById('status');
  const saveButton = document.getElementById('save-page-button');
  const subjectsDropdown = document.getElementById('subjects-dropdown');
  const logoutButton = document.getElementById('logout-button');
  const highlightToggle = document.getElementById('highlight-toggle');

  // Subject UI Elements
  const subjectSelectionContainer = document.getElementById('subject-selection-container');
  const addSubjectContainer = document.getElementById('add-subject-container');
  const addSubjectButton = document.getElementById('add-subject-button');
  const newSubjectNameInput = document.getElementById('new-subject-name');
  const cancelAddSubjectButton = document.getElementById('cancel-add-subject-button');
  const saveSubjectButton = document.getElementById('save-subject-button');

  // Helper to get data from storage
  const getStorageData = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));

  // Function to switch views
  const showMainApp = () => {
    loginContainer.style.display = 'none';
    mainAppContainer.style.display = 'block';
    initializeMainApp();
  };

  const showLogin = (errorMessage = null) => {
    mainAppContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    usernameInput.value = '';
    passwordInput.value = '';
    if (errorMessage) {
      loginError.textContent = errorMessage;
      loginError.style.display = 'block';
    } else {
      loginError.style.display = 'none';
    }
  };

  // Function to populate subjects dropdown
  const populateSubjects = (subjects, selectedId = null) => {
    subjectsDropdown.innerHTML = '';
    if (subjects && subjects.length > 0) {
      subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        subjectsDropdown.appendChild(option);
      });
      subjectsDropdown.disabled = false;
      if (selectedId && subjects.some(s => s.id == selectedId)) {
        subjectsDropdown.value = selectedId;
      }
    } else {
      const option = document.createElement('option');
      option.textContent = '사용 가능한 주제 없음';
      subjectsDropdown.appendChild(option);
      subjectsDropdown.disabled = true;
    }
  };

  // Function to fetch and update subjects list
  const fetchAndUpdateSubjects = async (selectIdAfterFetch = null) => {
    const { lastSelectedSubjectId } = await getStorageData(['lastSelectedSubjectId']);
    
    chrome.runtime.sendMessage({ action: 'getSubjects' }, (response) => {
      if (response && response.success) {
        const freshSubjects = response.data;
        chrome.storage.local.set({ cachedSubjects: freshSubjects });

        const idToSelect = selectIdAfterFetch 
            || (freshSubjects.some(s => s.id == lastSelectedSubjectId) ? lastSelectedSubjectId : (freshSubjects[0]?.id || null));

        populateSubjects(freshSubjects, idToSelect);
      } else if (response) {
        statusDiv.textContent = `주제 로딩 실패: ${response.error || '알 수 없는 오류'}`;
        if (response.shouldRelogin) {
          chrome.storage.local.remove(['accessToken', 'username', 'password', 'cachedSubjects', 'lastSelectedSubjectId'], () => {
            showLogin('세션이 만료되었습니다. 다시 로그인해주세요.');
          });
        }
      }
    });
  };

  // Function to initialize the main app logic
  const initializeMainApp = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      urlSpan.textContent = tab.url || '(알 수 없음)';
      
      // Initialize highlight toggle state
      const { [`highlight-enabled-${tab.id}`]: isEnabled } = await getStorageData([`highlight-enabled-${tab.id}`]);
      highlightToggle.checked = !!isEnabled;
    }

    const { cachedSubjects, lastSelectedSubjectId } = await getStorageData(['cachedSubjects', 'lastSelectedSubjectId']);
    if (cachedSubjects) {
      populateSubjects(cachedSubjects, lastSelectedSubjectId);
    }

    fetchAndUpdateSubjects();

    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);

    newSaveButton.addEventListener('click', async () => {
      if (!tab) {
        statusDiv.textContent = '탭 정보를 가져올 수 없습니다.';
        return;
      }

      const selectedSubjectId = subjectsDropdown.value;
      if (!selectedSubjectId || subjectsDropdown.disabled) {
        statusDiv.textContent = '저장할 주제를 선택해주세요.';
        return;
      }

      chrome.storage.local.set({ lastSelectedSubjectId: selectedSubjectId });

      statusDiv.textContent = '콘텐츠를 추출하는 중...';
      
      // Get highlights if enabled
      const isHighlightingEnabled = highlightToggle.checked;
      let highlights = [];
      if (isHighlightingEnabled) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getHighlights' });
          if (response && response.highlights) {
            highlights = response.highlights;
          }
        } catch (e) {
          console.error('하이라이트 정보 가져오기 실패:', e);
          statusDiv.textContent = '하이라이트 정보를 가져오는 데 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.';
          return;
        }
      }

      let contentResponse;
      try {
        contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getContent' });
      } catch (e) {
        console.error('콘텐츠 스크립트 통신 오류:', e);
        statusDiv.textContent = '현재 페이지의 콘텐츠를 가져올 수 없습니다.';
        return;
      }

      if (!contentResponse || !contentResponse.content) {
        statusDiv.textContent = '추출된 콘텐츠가 없습니다.';
        return;
      }

      const data = {
        title: tab.title,
        url: tab.url,
        content: contentResponse.content,
        subjectId: parseInt(selectedSubjectId, 10),
      };

      let action = 'submitData';
      let apiEndpoint = 'pages';

      if (highlights.length > 0) {
        data.highlights = highlights;
        const totalHighlightLength = highlights.reduce((acc, h) => acc + h.length, 0);
        
        if (totalHighlightLength > 300) {
          delete data.content; // content 필드 제거
          apiEndpoint = 'pages/highlight/large';
        } else {
          apiEndpoint = 'pages/highlight';
        }
        action = 'submitHighlightData'; // 백그라운드에서 처리할 액션 변경
        data.apiEndpoint = apiEndpoint; // 엔드포인트 정보 추가
      }

      statusDiv.textContent = '서버로 전송하는 중...';
      
      chrome.runtime.sendMessage({ action, data }, (serverResponse) => {
        if (serverResponse && serverResponse.success) {
          statusDiv.textContent = '페이지가 성공적으로 저장되었습니다!';
        } else {
          statusDiv.textContent = `오류: ${serverResponse.error || '알 수 없는 오류'}`;
          if (serverResponse.shouldRelogin) {
            chrome.storage.local.remove(['accessToken', 'username', 'password', 'cachedSubjects', 'lastSelectedSubjectId'], () => {
                showLogin('세션이 만료되었습니다. 다시 로그인해주세요.');
            });
          }
        }
      });
    });
  };

  // --- Event Listeners ---

  // Highlight toggle listener
  highlightToggle.addEventListener('change', async (event) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const isEnabled = event.target.checked;
      await chrome.storage.local.set({ [`highlight-enabled-${tab.id}`]: isEnabled });
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleHighlighting', enabled: isEnabled });
      } catch (e) {
        console.warn('콘텐츠 스크립트가 활성화되지 않았을 수 있습니다.', e);
        statusDiv.textContent = '페이지를 새로고침해야 하이라이트 기능이 활성화됩니다.';
      }
    }
  });

  // Check login status on popup open
  chrome.storage.local.get(['accessToken'], (result) => {
    if (result.accessToken) {
      showMainApp();
    } else {
      showLogin();
    }
  });

  // Handle Login Button Click
  loginButton.addEventListener('click', () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (username.length < 3 || username.length > 20) {
      loginError.textContent = '아이디는 3~20자여야 합니다.';
      loginError.style.display = 'block';
      return;
    }
    if (password.length < 8) {
      loginError.textContent = '비밀번호는 8자 이상이어야 합니다.';
      loginError.style.display = 'block';
      return;
    }
    loginError.style.display = 'none';

    loginButton.disabled = true;
    loginButton.textContent = '로그인 중...';

    chrome.runtime.sendMessage({ action: 'login', data: { username, password } }, (response) => {
      loginButton.disabled = false;
      loginButton.textContent = '로그인';

      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        loginError.textContent = '알 수 없는 오류가 발생했습니다.';
        loginError.style.display = 'block';
        return;
      }

      if (response && response.success) {
        showMainApp();
      } else {
        loginError.textContent = '아이디 또는 비밀번호를 확인해주세요.';
        loginError.style.display = 'block';
      }
    });
  });

  // Handle Logout Button Click
  logoutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['accessToken', 'username', 'password', 'cachedSubjects', 'lastSelectedSubjectId'], () => {
      console.log('Logged out and all user data cleared.');
      // 모든 탭의 하이라이트 상태도 초기화
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = Object.keys(items).filter(key => key.startsWith('highlight-enabled-'));
        chrome.storage.local.remove(keysToRemove);
      });
      showLogin();
    });
  });

  // Handle Subject UI switching
  addSubjectButton.addEventListener('click', () => {
    subjectSelectionContainer.style.display = 'none';
    addSubjectContainer.style.display = 'block';
    newSubjectNameInput.focus();
  });

  cancelAddSubjectButton.addEventListener('click', () => {
    addSubjectContainer.style.display = 'none';
    subjectSelectionContainer.style.display = 'block';
    newSubjectNameInput.value = '';
  });

  // Handle Save New Subject
  saveSubjectButton.addEventListener('click', () => {
    const newName = newSubjectNameInput.value.trim();
    if (!newName) {
      statusDiv.textContent = '주제 이름은 비워둘 수 없습니다.';
      return;
    }

    saveSubjectButton.disabled = true;
    saveSubjectButton.textContent = '저장 중...';

    chrome.runtime.sendMessage({ action: 'addSubject', name: newName }, (response) => {
      saveSubjectButton.disabled = false;
      saveSubjectButton.textContent = '저장';

      if (response && response.success) {
        statusDiv.textContent = `'${newName}' 주제가 추가되었습니다.`;
        newSubjectNameInput.value = '';
        addSubjectContainer.style.display = 'none';
        subjectSelectionContainer.style.display = 'block';
        // Fetch subjects again and select the new one
        fetchAndUpdateSubjects(response.data.id);
      } else {
        statusDiv.textContent = `오류: ${response.error || '주제 추가 실패'}`;
      }
    });
  });
});
