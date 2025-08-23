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

  // Function to switch views
  const showMainApp = () => {
    loginContainer.style.display = 'none';
    mainAppContainer.style.display = 'block';
    initializeMainApp();
  };

  const showLogin = (errorMessage = null) => {
    mainAppContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    usernameInput.value = ''; // Clear fields on show
    passwordInput.value = '';
    if (errorMessage) {
      loginError.textContent = errorMessage;
      loginError.style.display = 'block';
    } else {
      loginError.style.display = 'none';
    }
  };

  // Function to populate subjects dropdown
  const populateSubjects = (subjects) => {
    subjectsDropdown.innerHTML = ''; // Clear existing options
    if (subjects && subjects.length > 0) {
      subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        subjectsDropdown.appendChild(option);
      });
       subjectsDropdown.disabled = false;
    } else {
      const option = document.createElement('option');
      option.textContent = '사용 가능한 주제 없음';
      subjectsDropdown.appendChild(option);
      subjectsDropdown.disabled = true;
    }
  };

  // Function to initialize the main app logic
  const initializeMainApp = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      urlSpan.textContent = tab.url || '(알 수 없음)';
    }

    // Fetch and populate subjects
    chrome.runtime.sendMessage({ action: 'getSubjects' }, (response) => {
      if (response && response.success) {
        populateSubjects(response.data);
      } else {
        statusDiv.textContent = `주제 로딩 실패: ${response.error || '알 수 없는 오류'}`;
        if (response.shouldRelogin) {
            chrome.storage.local.remove(['accessToken', 'username', 'password'], () => {
                showLogin('세션이 만료되었습니다. 다시 로그인해주세요.');
            });
        }
      }
    });

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

      statusDiv.textContent = '콘텐츠를 추출하는 중...';
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

      statusDiv.textContent = '서버로 전송하는 중...';
      
      chrome.runtime.sendMessage({ action: 'submitData', data: data }, (serverResponse) => {
        if (serverResponse && serverResponse.success) {
          statusDiv.textContent = '페이지가 성공적으로 저장되었습니다!';
        } else {
          statusDiv.textContent = `오류: ${serverResponse.error || '알 수 없는 오류'}`;
          if (serverResponse.shouldRelogin) {
            chrome.storage.local.remove(['accessToken', 'username', 'password'], () => {
                showLogin('세션이 만료되었습니다. 다시 로그인해주세요.');
            });
          }
        }
      });
    });
  };

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

    chrome.runtime.sendMessage({ action: 'login', data: { username, password } }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        loginError.textContent = '알 수 없는 오류가 발생했습니다.';
        loginError.style.display = 'block';
        return;
      }

      if (response && response.success) {
        showMainApp();
      } else {
        loginError.textContent = (response && response.error) || '로그인 실패. 아이디/비밀번호를 확인하세요.';
        loginError.style.display = 'block';
      }
    });
  });

  // Handle Logout Button Click
  logoutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['accessToken', 'username', 'password'], () => {
      console.log('Logged out and token removed.');
      showLogin();
    });
  });
});