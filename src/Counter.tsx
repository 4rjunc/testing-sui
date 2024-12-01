import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import type { SuiObjectData } from "@mysten/sui/client";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useNetworkVariable } from "./networkConfig";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";

export function Counter({ id }: { id: string }) {
  const counterPackageId = useNetworkVariable("counterPackageId");
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { data, isPending, error, refetch } = useSuiClientQuery("getObject", {
    id,
    options: {
      showContent: true,
      showOwner: true,
    },
  });

  const [waitingForTxn, setWaitingForTxn] = useState("");

  const call = async () => {
    const riskCoverage: number = 1000;
    const totalShares = 10;
    const collateralAmount = 1000000;

    console.log("new_risk fun called call");

    const tx = new Transaction();

    console.log("new_risk tx", tx);

    try {
      //const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(collateralAmount)]);
      const coin = coinWithBalance({ balance: collateralAmount });
      console.log("new_risk coin", coin);

      // tx.setGasBudget(500000000);
      tx.moveCall({
        target:
          "0xb2087842194cfe22aa67f2ffebc43d27b83338e175ab13965b5ad032d8ab73ed::contract::new_risk",
        arguments: [
          tx.pure.u64(riskCoverage),
          tx.pure.u64(totalShares),
          tx.object(coin),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (tx) => {
            suiClient
              .waitForTransaction({ digest: tx.digest })
              .then(async () => {
                await refetch();
                setWaitingForTxn("");
                console.log(`Transaction successful: ${tx.digest}`);
              });
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
          },
        },
      );
    } catch (error) {
      console.error("Error during transaction setup or execution:", error);
    }
  };

  const executeMoveCall = (method: "increment" | "reset") => {
    setWaitingForTxn(method);

    const tx = new Transaction();
    console.log(" executeMoveCall tx", tx);

    if (method === "reset") {
      tx.moveCall({
        arguments: [tx.object(id), tx.pure.u64(0)],
        target: `${counterPackageId}::counter::set_value`,
      });
    } else {
      tx.moveCall({
        arguments: [tx.object(id)],
        target: `${counterPackageId}::counter::increment`,
      });
    }

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: (tx) => {
          suiClient.waitForTransaction({ digest: tx.digest }).then(async () => {
            await refetch();
            setWaitingForTxn("");
          });
        },
      },
    );
  };

  if (isPending) return <Text>Loading...</Text>;

  if (error) return <Text>Error: {error.message}</Text>;

  if (!data.data) return <Text>Not found</Text>;

  const ownedByCurrentAccount =
    getCounterFields(data.data)?.owner === currentAccount?.address;

  return (
    <>
      <Heading size="3">Counter {id}</Heading>

      <Flex direction="column" gap="2">
        <Text>Count: {getCounterFields(data.data)?.value}</Text>
        <Button onClick={call}>CALL the transaction</Button>
        <Flex direction="row" gap="2">
          <Button
            onClick={() => executeMoveCall("increment")}
            disabled={waitingForTxn !== ""}
          >
            {waitingForTxn === "increment" ? (
              <ClipLoader size={20} />
            ) : (
              "Increment"
            )}
          </Button>
          {ownedByCurrentAccount ? (
            <Button
              onClick={() => executeMoveCall("reset")}
              disabled={waitingForTxn !== ""}
            >
              {waitingForTxn === "reset" ? <ClipLoader size={20} /> : "Reset"}
            </Button>
          ) : null}
        </Flex>
      </Flex>
    </>
  );
}
function getCounterFields(data: SuiObjectData) {
  if (data.content?.dataType !== "moveObject") {
    return null;
  }

  return data.content.fields as { value: number; owner: string };
}
