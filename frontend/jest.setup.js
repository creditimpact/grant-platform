import '@testing-library/jest-dom';

// Mock Next.js App Router for tests (App Router)
jest.mock('next/navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  const prefetch = jest.fn();
  return {
    useRouter: () => ({ push, replace, back, prefetch }),
  };
});
