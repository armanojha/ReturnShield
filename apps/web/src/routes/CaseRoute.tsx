import {
  Link,
  useParams,
} from 'react-router-dom';

import { CaseDetail } from '../components/CaseDetail';

export function CaseRoute(): JSX.Element {
  const {
    caseId = '',
  } = useParams();

  return (
    <>
      <div className="route-back">
        <Link to="/ops">
          ← Back to operations
        </Link>
      </div>

      <CaseDetail
        caseId={caseId}
      />
    </>
  );
}

export default CaseRoute;
