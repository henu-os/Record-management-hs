/**
 * HENU OS RECORDS MANAGEMENT — 3D HOMEPAGE INTERACTIVE LOGIC
 */

document.addEventListener('DOMContentLoaded', () => {
  const deck = document.querySelector('.document-deck');
  const heroSection = document.querySelector('.hero-section');

  // 3D Parallax & Tilt on Mouse Move
  if (deck && heroSection) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const rotateX = -(y / rect.height) * 20;
      const rotateY = (x / rect.width) * 24;

      deck.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    heroSection.addEventListener('mouseleave', () => {
      deck.style.transform = 'rotateX(0deg) rotateY(0deg)';
      deck.style.transition = 'transform 0.6s ease';
    });
  }

  // Interactive 3D Register Card Tilt
  const registerCards = document.querySelectorAll('.register-card-3d');
  registerCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const rotateX = -(y / rect.height) * 12;
      const rotateY = (x / rect.width) * 14;

      card.style.transform = `translateY(-8px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) rotateX(0deg) rotateY(0deg)';
    });
  });

  // Simulated Live Data Flow Animation in Pipeline Section
  const pipelineNodes = document.querySelectorAll('.pipeline-node');
  if (pipelineNodes.length > 0) {
    let activeIndex = 0;
    setInterval(() => {
      pipelineNodes.forEach((node, idx) => {
        if (idx === activeIndex) {
          node.style.borderColor = 'var(--accent-light)';
          node.style.boxShadow = '0 0 25px rgba(124, 58, 237, 0.4)';
        } else {
          node.style.borderColor = 'var(--border-glass)';
          node.style.boxShadow = 'none';
        }
      });
      activeIndex = (activeIndex + 1) % pipelineNodes.length;
    }, 2000);
  }
});
