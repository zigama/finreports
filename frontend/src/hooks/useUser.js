import { getToken } from '../api/client';
import { parseJwt } from '../utils/jwt';

export function useUser() {
  const token = getToken();
  const claims = token ? parseJwt(token) : null;

  return {
    isAuthenticated: !!token,
    accessLevel: claims?.access_level,
    countryId: claims?.country_id,
    hospitalId: claims?.hospital_id,
    facilityId: claims?.facility_id,
    isCountry: claims?.access_level === 'COUNTRY',
  };
}
