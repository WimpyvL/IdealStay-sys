import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        <p className="footer__copyright">
          © 2025 IdealStay. All rights reserved.
        </p>
        <div className="footer__links">
          <a href="#" className="footer__link">Privacy Policy</a>
          <a href="#" className="footer__link">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
