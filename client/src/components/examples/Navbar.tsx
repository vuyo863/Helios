import Navbar from '../Navbar';
import { Route, Switch } from 'wouter';

export default function NavbarExample() {
  return (
    <div>
      <Navbar />
      <Switch>
        <Route path="/">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Übersicht Seite</h2>
          </div>
        </Route>
        <Route path="/upload">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Upload Seite</h2>
          </div>
        </Route>
        <Route path="/reports">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Berichte Seite</h2>
          </div>
        </Route>
      </Switch>
    </div>
  );
}
