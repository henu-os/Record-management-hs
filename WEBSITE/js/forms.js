/**
 * HENU OS RECORDS MANAGEMENT — FORMS & FEEDBACK HANDLER
 */

const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxrg0we3kXrWsnuG437-P09NPOAcZjLGTf_Mzt0Z3tkK1CFTXNVLrBDOluHrZB8rS5o/exec';

async function submitToGoogleSheet(sheetName, form) {
  const formData = new FormData(form);
  formData.append('sheet', sheetName);

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: formData,
    mode: 'cors'
  });

  if (!response.ok) {
    throw new Error(`Submission failed with status ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.result && result.result !== 'success') {
    throw new Error(result.message || 'Google Sheet submission failed.');
  }

  return result;
}

document.addEventListener('DOMContentLoaded', () => {
  // Feedback Form Handler
  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = feedbackForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting Feedback...';

      try {
        await submitToGoogleSheet('Feedback', feedbackForm);
        feedbackForm.reset();
        showToast('✅ Thank you! Your feedback has been logged successfully.', 'success');
      } catch (error) {
        console.error('Feedback submit error:', error);
        showToast('⚠️ Feedback could not be sent right now. Please try again or contact support directly.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Contact Form Handler
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending Inquiry...';

      try {
        await submitToGoogleSheet('Inquiries', contactForm);
        contactForm.reset();
        showToast('✅ Thank you! Your inquiry has been sent to HENU OS Support.', 'success');
      } catch (error) {
        console.error('Inquiry submit error:', error);
        showToast('⚠️ Inquiry could not be sent right now. Please try again or contact support directly.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
});
