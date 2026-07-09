(function () {
  var config = window.FAW_SITE_CONFIG || {};
  var notifyEmail = config.notifyEmail || 'malikkhan0225@gmail.com';

  function endpoint() {
    return 'https://formsubmit.co/ajax/' + encodeURIComponent(notifyEmail);
  }

  async function sendEmail(payload) {
    var body = Object.assign({
      _template: 'table',
      _captcha: 'false'
    }, payload);

    var res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      var errText = '';
      try {
        var data = await res.json();
        errText = data.message || '';
      } catch (e) { /* ignore */ }
      throw new Error(errText || 'Unable to send. Please try again.');
    }

    return res.json().catch(function () { return {}; });
  }

  window.FAWForms = {
    notifyEmail: notifyEmail,
    sendEmail: sendEmail
  };
})();
