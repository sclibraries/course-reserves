// Header.jsx
import {
  Navbar,
  NavbarBrand,

} from 'reactstrap';
import { Link } from 'react-router-dom';
import '../Header.css';

function Header() {

  return (
    <header>
      <Navbar color="light" light expand="md" fixed="top" className="shadow-sm">
        <NavbarBrand tag={Link} to="/">
         <img src="https://www.smith.edu/themes/custom/smith/assets/images/libraries-logo.svg" alt="Smith College Libraries" />
        </NavbarBrand>
      </Navbar>
    </header>
  );
}

export default Header;
