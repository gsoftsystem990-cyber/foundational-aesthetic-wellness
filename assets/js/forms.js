(function () {
  var config = window.FAW_SITE_CONFIG || {};
  var notifyEmail = config.notifyEmail || 'malikkhan0225@gmail.com';
  var web3formsKey = config.web3formsAccessKey || '';

  function formsubmitEndpoint() {
    return 'https://formsubmit.co/ajax/' + encodeURIComponent(notifyEmail);
  }

  function isFailureResponse(data) {
    return !!(data && (data.success === 'false' || data.success === false));
  }

  async function sendViaWeb3Forms(payload) {
    if (!web3formsKey) return null;

    var body = Object.assign({
      access_key: web3formsKey,
      from_name: 'Foundational Aesthetic Wellness Website'
    }, payload);

    var res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.success) {
      throw new Error((data && data.message) || 'Unable to send. Please try again.');
    }
    return data;
  }

  function formatSendError(data, fallback) {
    var msg = (data && data.message) || fallback || 'Unable to send. Please try again.';
    if (/activation|activate form/i.test(msg)) {
      return (
        'One-time email setup is required. Check ' + notifyEmail +
        ' (and spam) for an email from FormSubmit with subject like "Activate Form". ' +
        'Click the activation link, then submit the review again.'
      );
    }
    return msg;
  }

  async function sendViaFormSubmit(payload) {
    var body = Object.assign({
      _template: 'table',
      _captcha: 'false'
    }, payload);

    var res = await fetch(formsubmitEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || isFailureResponse(data)) {
      throw new Error(formatSendError(data, 'Unable to send. Please try again.'));
    }
    return data;
  }

  async function sendEmail(payload) {
    if (web3formsKey) {
      try {
        return await sendViaWeb3Forms(payload);
      } catch (web3Err) {
        console.warn('Web3Forms failed, trying FormSubmit:', web3Err);
      }
    }
    return sendViaFormSubmit(payload);
  }

  window.FAWForms = {
    notifyEmail: notifyEmail,
    sendEmail: sendEmail
  };
})();
